import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type Requester } from "@ador/client-http";

import { createBalanceStore } from "../src/client/balance-store.ts";

const mine = { address: "tb1qmine", network: "signet" as const };
const other = { address: "tb1qother", network: "signet" as const };
const ready = (satoshis: number) => ({
  asOf: "2026-10-15T12:00:00.000Z",
  satoshis,
  status: "ready" as const,
});

// A requester whose answers the test hands out one at a time.
function requester() {
  const pending: ((answer: unknown) => void)[] = [];
  const failures: ((error: Error) => void)[] = [];
  const request = vi.fn(
    () =>
      new Promise((resolve, reject) => {
        pending.push(resolve);
        failures.push(reject);
      }),
  );
  return {
    answer: (value: unknown, index = pending.length - 1) =>
      pending[index]?.(value),
    fail: (index = failures.length - 1) =>
      failures[index]?.(new ApiError("network", null, "down")),
    request: request as unknown as Requester,
    spy: request,
  };
}
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the balance store", () => {
  it("asks nothing while the menu is closed, or while no wallet is connected", async () => {
    const closed = requester();
    const withWallet = createBalanceStore({
      intervalMs: 60_000,
      request: closed.request,
    });
    withWallet.setTarget(mine);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(closed.spy).not.toHaveBeenCalled();
    expect(withWallet.snapshot().state).toBe("idle");

    const none = requester();
    const withoutWallet = createBalanceStore({
      intervalMs: 60_000,
      request: none.request,
    });
    withoutWallet.setOpen(true);
    await vi.advanceTimersByTimeAsync(180_000);
    await withoutWallet.refresh();
    expect(none.spy).not.toHaveBeenCalled();
    expect(withoutWallet.snapshot().state).toBe("idle");
  });

  it("asks once when the menu opens, then every interval while it stays open, and stops when it closes", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    expect(r.spy).toHaveBeenCalledTimes(1);
    expect(store.snapshot().state).toBe("loading");
    r.answer(ready(1000));
    await flush();
    expect(store.snapshot()).toEqual({
      reading: { asOf: "2026-10-15T12:00:00.000Z", satoshis: 1000 },
      reason: null,
      state: "ready",
    });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(r.spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(r.spy).toHaveBeenCalledTimes(2);
    expect(store.snapshot().state).toBe("refreshing");
    store.setOpen(false);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(r.spy).toHaveBeenCalledTimes(2);
    store.setOpen(true);
    expect(r.spy).toHaveBeenCalledTimes(3);
  });

  it("sends the wallet's address and network, and a manual refresh asks again at once", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    const calls: readonly (readonly unknown[])[] = r.spy.mock.calls;
    expect(calls[0]?.[2]).toEqual({ body: mine });
    r.answer(ready(1));
    await flush();
    void store.refresh();
    expect(r.spy).toHaveBeenCalledTimes(2);
  });

  it("shows an older number as stale when the next try fails, and recovers on the next answer", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    r.answer(ready(5));
    await flush();
    void store.refresh();
    r.fail();
    await flush();
    expect(store.snapshot()).toMatchObject({
      reading: { satoshis: 5 },
      state: "stale",
    });
    void store.refresh();
    r.answer(ready(6));
    await flush();
    expect(store.snapshot()).toMatchObject({
      reading: { satoshis: 6 },
      state: "ready",
    });
  });

  it("says failed when the first try fails, and unavailable (with the reason) when the platform has no number", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    r.fail();
    await flush();
    expect(store.snapshot()).toEqual({
      reading: null,
      reason: null,
      state: "failed",
    });
    void store.refresh();
    r.answer({ reason: "not-configured", status: "unavailable" });
    await flush();
    expect(store.snapshot()).toEqual({
      reading: null,
      reason: "not-configured",
      state: "unavailable",
    });
  });

  it("keeps an older number as stale when the platform later has none to give", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    r.answer(ready(9));
    await flush();
    void store.refresh();
    r.answer({ reason: "source-failed", status: "unavailable" });
    await flush();
    expect(store.snapshot()).toEqual({
      reading: { asOf: "2026-10-15T12:00:00.000Z", satoshis: 9 },
      reason: "source-failed",
      state: "stale",
    });
  });

  it("forgets the number for a different wallet and drops an answer meant for the old one", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    r.answer(ready(100), 0);
    await flush();
    void store.refresh();
    store.setTarget(other);
    expect(store.snapshot()).toEqual({
      reading: null,
      reason: null,
      state: "loading",
    });
    // The old wallet's answer arrives late and must not become the new wallet's balance.
    r.answer(ready(777), 1);
    await flush();
    expect(store.snapshot().reading).toBeNull();
    r.answer(ready(42), 2);
    await flush();
    expect(store.snapshot().reading?.satoshis).toBe(42);
  });

  it("keeps the number when the same wallet is set again, and treats the same address on another network as another wallet", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    store.setTarget(mine);
    store.setOpen(true);
    r.answer(ready(3));
    await flush();
    store.setTarget({ ...mine });
    expect(store.snapshot().reading?.satoshis).toBe(3);
    expect(r.spy).toHaveBeenCalledTimes(1);
    store.setTarget({ ...mine, network: "mainnet" });
    expect(store.snapshot().reading).toBeNull();
  });

  it("tells subscribers about each change and not after they leave", async () => {
    const r = requester();
    const store = createBalanceStore({
      intervalMs: 60_000,
      request: r.request,
    });
    const listener = vi.fn();
    const leave = store.subscribe(listener);
    store.setTarget(mine);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.snapshot()).toBe(store.snapshot());
    leave();
    store.setTarget(other);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
