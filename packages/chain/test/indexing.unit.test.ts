import {
  chainRefSchema,
  type ChainRef,
  type IndexingStatus,
} from "@ador/shared/chain";
import { describe, expect, it, vi } from "vitest";

import {
  cacheIndexing,
  createDelayJudge,
  readIndexing,
} from "../src/indexing.ts";
import type { ChainObserver } from "../src/ports.ts";

const chain = chainRefSchema.parse("bip122:00000008819873e925422c1ff0f99f7c");
const other = chainRefSchema.parse("simnet:one");
const reading = (height: number): IndexingStatus => ({
  chain,
  indexedHeight: height,
  observedAt: "2026-10-17T12:00:00.000Z",
  tipHeight: height + 1,
});

function observerOf(indexing: ChainObserver["indexing"]): ChainObserver {
  return {
    balance: () => Promise.reject(new Error("not used")),
    feeRates: () => Promise.reject(new Error("not used")),
    indexing,
    observe: () => Promise.reject(new Error("not used")),
  };
}

describe("reading the indexer", () => {
  it("gives the reading, or null where there is no chain to ask or it cannot be asked", async () => {
    expect(
      await readIndexing(
        observerOf(async () => reading(7)),
        chain,
      ),
    ).toEqual(reading(7));
    expect(await readIndexing(null, chain)).toBeNull();
    expect(
      await readIndexing(
        observerOf(() => Promise.reject(new Error("the node is down"))),
        chain,
      ),
    ).toBeNull();
  });
});

describe("caching the reading", () => {
  const clock = { now: new Date("2026-10-17T12:00:00.000Z") };
  const cached = (inner: ChainObserver, ttlMs = 15_000) =>
    cacheIndexing(inner, { now: () => clock.now, ttlMs });
  const after = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };

  it("asks the chain once for readings within the time, and again after it, and separately for each chain", async () => {
    const indexing = vi.fn(async (asked: typeof chain) => ({
      ...reading(indexing.mock.calls.length),
      chain: asked,
    }));
    const observer = cached(observerOf(indexing));
    const first = await observer.indexing(chain);
    after(14_999);
    expect(await observer.indexing(chain)).toBe(first);
    expect(indexing).toHaveBeenCalledTimes(1);
    await observer.indexing(other);
    expect(indexing).toHaveBeenCalledTimes(2);
    after(1);
    const later = await observer.indexing(chain);
    expect(later).not.toBe(first);
    expect(later.indexedHeight).toBe(3);
  });

  it("lets callers who arrive while a reading is on its way share it", async () => {
    let finish: (value: IndexingStatus) => void = () => undefined;
    const indexing = vi.fn(
      () => new Promise<IndexingStatus>((resolve) => (finish = resolve)),
    );
    const observer = cached(observerOf(indexing));
    const both = Promise.all([
      observer.indexing(chain),
      observer.indexing(chain),
    ]);
    finish(reading(1));
    const [a, b] = await both;
    expect(a).toBe(b);
    expect(indexing).toHaveBeenCalledTimes(1);
  });

  it("never keeps a failed reading, so the next caller asks again", async () => {
    const indexing = vi
      .fn<ChainObserver["indexing"]>()
      .mockRejectedValueOnce(new Error("the node is down"))
      .mockResolvedValueOnce(reading(9));
    const observer = cached(observerOf(indexing));
    await expect(observer.indexing(chain)).rejects.toThrow("the node is down");
    expect((await observer.indexing(chain)).indexedHeight).toBe(9);
    expect(indexing).toHaveBeenCalledTimes(2);
  });

  it("does not let an old failure remove a newer reading", async () => {
    let fail: (error: Error) => void = () => undefined;
    const indexing = vi
      .fn<ChainObserver["indexing"]>()
      .mockImplementationOnce(
        () => new Promise((_resolve, reject) => (fail = reject)),
      )
      .mockResolvedValueOnce(reading(5));
    const observer = cached(observerOf(indexing), 1_000);
    const old = observer.indexing(chain);
    old.catch(() => undefined);
    after(1_000);
    const fresh = await observer.indexing(chain);
    fail(new Error("late"));
    await expect(old).rejects.toThrow("late");
    expect(await observer.indexing(chain)).toBe(fresh);
    expect(indexing).toHaveBeenCalledTimes(2);
  });

  it("asks for the fee rates at most once in the time to live for the same targets, and again for other targets or after it", async () => {
    const feeRates = vi.fn(
      async (_chain: ChainRef, targets: readonly number[]) =>
        targets.map((target) => ({ satPerVb: 2, targetBlocks: target })),
    );
    const observer = cacheIndexing(
      { ...observerOf(async () => reading(1)), feeRates },
      { now: () => clock.now, ttlMs: 1_000 },
    );
    await observer.feeRates(chain, [1, 3]);
    await observer.feeRates(chain, [1, 3]);
    expect(feeRates).toHaveBeenCalledTimes(1);
    await observer.feeRates(chain, [6]);
    expect(feeRates).toHaveBeenCalledTimes(2);
    clock.now = new Date(clock.now.getTime() + 1_000);
    await observer.feeRates(chain, [1, 3]);
    expect(feeRates).toHaveBeenCalledTimes(3);
  });

  it("never keeps a fee quote that failed", async () => {
    const feeRates = vi
      .fn<ChainObserver["feeRates"]>()
      .mockRejectedValueOnce(new Error("the node is down"))
      .mockResolvedValueOnce([{ satPerVb: 2, targetBlocks: 1 }]);
    const observer = cacheIndexing(
      { ...observerOf(async () => reading(1)), feeRates },
      { now: () => clock.now, ttlMs: 1_000 },
    );
    await expect(observer.feeRates(chain, [1])).rejects.toThrow("down");
    expect(await observer.feeRates(chain, [1])).toEqual([
      { satPerVb: 2, targetBlocks: 1 },
    ]);
  });

  it("passes observations straight through", async () => {
    const observe = vi.fn(() => Promise.reject(new Error("seen")));
    const observer = cacheIndexing(
      {
        balance: () => Promise.reject(new Error("not used")),
        feeRates: () => Promise.reject(new Error("not used")),
        indexing: async () => reading(1),
        observe,
      },
      { now: () => clock.now, ttlMs: 1 },
    );
    await expect(observer.observe({ chain, id: "abc" })).rejects.toThrow(
      "seen",
    );
    expect(observe).toHaveBeenCalledWith({ chain, id: "abc" });
  });
});

describe("judging which waits are delayed", () => {
  const policy = { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 };
  const now = new Date("2026-10-17T12:00:00.000Z");
  const sent = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  const behind = (lag: number): ChainObserver => ({
    balance: () => Promise.reject(new Error("not used")),
    feeRates: () => Promise.reject(new Error("not used")),
    indexing: async (asked) => ({
      chain: asked,
      indexedHeight: 100,
      observedAt: now.toISOString(),
      tipHeight: 100 + lag,
    }),
    observe: () => Promise.reject(new Error("not used")),
  });
  const judgeWith = (observers: Map<typeof chain, ChainObserver>) =>
    createDelayJudge({
      now: () => now,
      ports: (asked) => {
        const observer = observers.get(asked);
        return observer === undefined ? null : { observer };
      },
      policy,
    });

  it("judges each by its own state, send time and chain, in the order given", async () => {
    const judge = judgeWith(new Map([[chain, behind(3)]]));
    expect(
      await judge([
        { broadcastAt: sent(1), chain, state: "pending" },
        { broadcastAt: sent(1), chain, state: "complete" },
        { broadcastAt: null, chain, state: "awaiting_signature" },
        { broadcastAt: sent(1), chain, state: "indexed_failure" },
        { broadcastAt: sent(1), chain: other, state: "pending" },
        { broadcastAt: sent(90), chain: other, state: "confirmed" },
      ]),
    ).toEqual([true, false, false, false, false, true]);
  });

  it("does not delay a wait the indexer is keeping up with, and asks it once for each chain with something waiting", async () => {
    const indexing = vi.fn(behind(1).indexing);
    const judge = judgeWith(new Map([[chain, { ...behind(1), indexing }]]));
    expect(
      await judge([
        { broadcastAt: sent(5), chain, state: "pending" },
        { broadcastAt: sent(6), chain, state: "broadcast_accepted" },
        { broadcastAt: sent(7), chain, state: "confirmed" },
      ]),
    ).toEqual([false, false, false]);
    expect(indexing).toHaveBeenCalledTimes(1);
    indexing.mockClear();
    await judge([{ broadcastAt: sent(5), chain, state: "complete" }]);
    expect(indexing).not.toHaveBeenCalled();
  });

  it("falls back to the time when the chain cannot be asked", async () => {
    const down: ChainObserver = {
      ...behind(0),
      indexing: () => Promise.reject(new Error("the node is down")),
    };
    const judge = judgeWith(new Map([[chain, down]]));
    expect(
      await judge([
        { broadcastAt: sent(59), chain, state: "pending" },
        { broadcastAt: sent(61), chain, state: "pending" },
      ]),
    ).toEqual([false, true]);
  });
});
