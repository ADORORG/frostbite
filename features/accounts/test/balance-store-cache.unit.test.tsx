import {
  createExpiringStore,
  type KeyValueStorage,
} from "@ador/cache/expiring-store";
import { ApiError, type Requester } from "@ador/client-http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { balanceReadingSchema } from "../src/balance/contract.ts";
import { createBalanceStore } from "../src/client/balance-store.ts";

const mine = { address: "tb1qmine", network: "signet" as const };
const other = { address: "tb1qother", network: "signet" as const };
const intervalMs = 60_000;
const answer = (satoshis: number) => ({
  asOf: "2026-10-15T12:00:00.000Z",
  pendingSats: 0,
  satoshis,
  status: "ready" as const,
});

// One browser's storage, shared by every store made on it, as the tabs of a browser share theirs.
function browser() {
  const items = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (key) => items.get(key) ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
  const tab = (request: Requester) =>
    createBalanceStore({
      cache: createExpiringStore({
        maxAgeMs: intervalMs,
        now: () => new Date(),
        prefix: "ador:balance",
        schema: balanceReadingSchema,
        storage,
      }),
      intervalMs,
      request,
    });
  return { items, tab };
}
const asks = (...answers: unknown[]) => {
  let at = 0;
  return vi.fn(async () => {
    const next = answers[Math.min(at++, answers.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as Requester & ReturnType<typeof vi.fn>;
};
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

describe("the balance store with readings shared by the browser", () => {
  it("shows what another tab or an earlier page read at once, and does not ask for it again", async () => {
    const { tab } = browser();
    const first = asks(answer(5_000));
    const one = tab(first);
    one.setTarget(mine);
    one.setOpen(true);
    await flush();
    expect(one.snapshot().reading?.satoshis).toBe(5_000);

    await vi.advanceTimersByTimeAsync(10_000);
    const second = asks(answer(9_999));
    const two = tab(second);
    two.setTarget(mine);
    two.setOpen(true);
    expect(two.snapshot()).toMatchObject({
      reading: { satoshis: 5_000 },
      state: "ready",
    });
    await vi.advanceTimersByTimeAsync(40_000);
    expect(second).not.toHaveBeenCalled();
  });

  it("asks once the shared reading is an interval old, and then shows and shares the new one", async () => {
    const { tab } = browser();
    const first = asks(answer(5_000));
    const one = tab(first);
    one.setTarget(mine);
    one.setOpen(true);
    await flush();
    // That tab is closed, so only the age of what it left is in question.
    one.setOpen(false);
    await vi.advanceTimersByTimeAsync(intervalMs);
    const second = asks(answer(6_000));
    const two = tab(second);
    two.setTarget(mine);
    two.setOpen(true);
    await flush();
    expect(second).toHaveBeenCalledTimes(1);
    expect(two.snapshot().reading?.satoshis).toBe(6_000);
  });

  it("takes up a younger reading another tab shared at each tick instead of asking, so two tabs make one ask a minute", async () => {
    const { tab } = browser();
    const first = asks(answer(1), answer(2), answer(3), answer(4));
    const second = asks(answer(1), answer(2), answer(3), answer(4));
    const one = tab(first);
    one.setTarget(mine);
    one.setOpen(true);
    await vi.advanceTimersByTimeAsync(30_000);
    const two = tab(second);
    two.setTarget(mine);
    two.setOpen(true);
    await vi.advanceTimersByTimeAsync(5 * intervalMs);
    expect(
      first.mock.calls.length + second.mock.calls.length,
    ).toBeLessThanOrEqual(7);
    expect(second.mock.calls.length).toBeLessThanOrEqual(
      first.mock.calls.length,
    );
  });

  it("always asks the platform when the player asks", async () => {
    const { tab } = browser();
    const request = asks(answer(5_000), answer(7_000));
    const store = tab(request);
    store.setTarget(mine);
    store.setOpen(true);
    await flush();
    await store.refresh();
    expect(request).toHaveBeenCalledTimes(2);
    expect(store.snapshot().reading?.satoshis).toBe(7_000);
  });

  it("keeps each wallet's reading apart, and forgets a wallet's reading when it is no longer connected", async () => {
    const { items, tab } = browser();
    const store = tab(asks(answer(5_000), answer(8_000)));
    store.setTarget(mine);
    store.setOpen(true);
    await flush();
    expect([...items.keys()]).toEqual(["ador:balance:signet:tb1qmine"]);
    store.setTarget(other);
    await flush();
    expect(store.snapshot().reading?.satoshis).toBe(8_000);
    expect([...items.keys()]).toEqual(["ador:balance:signet:tb1qother"]);
    store.setTarget(null);
    expect(items.size).toBe(0);
  });

  it("keeps nothing of an answer that is not a balance, or of a failed ask", async () => {
    const { items, tab } = browser();
    const store = tab(
      asks(
        { reason: "source-failed", status: "unavailable" },
        new ApiError("network", null, "down"),
      ),
    );
    store.setTarget(mine);
    store.setOpen(true);
    await flush();
    await store.refresh();
    expect(items.size).toBe(0);
  });

  it("ignores a stored reading that is not a balance", async () => {
    const { items, tab } = browser();
    items.set("ador:balance:signet:tb1qmine", '{"readAt":0,"value":{}}');
    const request = asks(answer(5_000));
    const store = tab(request);
    store.setTarget(mine);
    store.setOpen(true);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(store.snapshot().reading?.satoshis).toBe(5_000);
  });
});
