import { describe, expect, it, vi } from "vitest";

import { idleConnection } from "../src/client/connection-client.ts";
import { createConnectionStore } from "../src/client/connection-store.ts";

const live = idleConnection("signet", async () => undefined);

describe("the connection store", () => {
  it("starts with nothing loaded and nothing wanted", () => {
    expect(createConnectionStore().get()).toEqual({
      live: null,
      wanted: false,
    });
  });

  it("is woken once, however often it is asked, and tells listeners only of a change", () => {
    const store = createConnectionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.wake();
    store.wake();
    expect(store.get().wanted).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("publishes the live connection, tells listeners, and ignores the same one again", () => {
    const store = createConnectionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.publish(live);
    store.publish(live);
    expect(store.get().live).toBe(live);
    expect(listener).toHaveBeenCalledTimes(1);
    store.publish(null);
    expect(store.get().live).toBeNull();
  });

  it("stops telling a listener that unsubscribed", () => {
    const store = createConnectionStore();
    const listener = vi.fn();
    store.subscribe(listener)();
    store.wake();
    expect(listener).not.toHaveBeenCalled();
  });

  it("answers whenLive at once if the connection is there, and otherwise when it is published", async () => {
    const store = createConnectionStore();
    let resolved = false;
    const pending = store.whenLive().then((client) => {
      resolved = true;
      return client;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    store.publish(live);
    expect(await pending).toBe(live);
    expect(await store.whenLive()).toBe(live);
  });

  it("does not resolve a wait for the connection being withdrawn", async () => {
    const store = createConnectionStore();
    store.publish(null);
    let resolved = false;
    void store.whenLive().then(() => (resolved = true));
    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it("waits for a published connection to be ready, and uses it as it is once the wait is over", async () => {
    vi.useFakeTimers();
    const store = createConnectionStore();
    const settled = { ...live, isInstalled: () => true };
    const answered: unknown[] = [];
    void store
      .whenLive((client) => client.isInstalled("xverse"), 1_000)
      .then((client) => answered.push(client));
    store.publish(live);
    await vi.advanceTimersByTimeAsync(500);
    expect(answered).toEqual([]);
    store.publish(settled);
    await vi.advanceTimersByTimeAsync(0);
    expect(answered).toEqual([settled]);

    const unready = createConnectionStore();
    const late: unknown[] = [];
    void unready
      .whenLive(() => false, 1_000)
      .then((client) => late.push(client));
    await vi.advanceTimersByTimeAsync(1_500);
    expect(late).toEqual([]);
    unready.publish(live);
    await vi.advanceTimersByTimeAsync(0);
    expect(late).toEqual([live]);
    vi.useRealTimers();
  });

  it("uses a connection that never becomes ready when the wait ends", async () => {
    vi.useFakeTimers();
    const store = createConnectionStore();
    store.publish(live);
    const answered: unknown[] = [];
    void store
      .whenLive(() => false, 1_000)
      .then((client) => answered.push(client));
    await vi.advanceTimersByTimeAsync(999);
    expect(answered).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(answered).toEqual([live]);
    vi.useRealTimers();
  });
});
