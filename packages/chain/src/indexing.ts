import {
  isDelayed,
  isWaiting,
  stageOf,
  type ChainRef,
  type DelayPolicy,
  type FeeRate,
  type IndexingStatus,
  type TrackedState,
} from "@ador/shared/chain";

import type { ChainObserver } from "./ports.ts";

// What a service learns of the indexer when it decides whether a wait is delayed: the reading, or null where the chain could not be
// asked (or there is no chain to ask). A missing reading is never read as "fine" or as "behind"; the caller falls back to the time.
export async function readIndexing(
  observer: Pick<ChainObserver, "indexing"> | null,
  chain: ChainRef,
): Promise<IndexingStatus | null> {
  if (observer === null) return null;
  try {
    return await observer.indexing(chain);
  } catch {
    return null;
  }
}

// An observer that asks the chain how far its indexer has read, and what its fee market quotes, at most once in `ttlMs`, however many ask:
// every page shows both, so uncached each would be a request to the node per visitor. Callers that arrive while a reading is on its way
// share it, and a failed reading is never kept, so the next caller asks again.
export function cacheIndexing(
  observer: ChainObserver,
  options: { readonly now: () => Date; readonly ttlMs: number },
): ChainObserver {
  const readings = new Map<
    ChainRef,
    { readonly at: number; readonly reading: Promise<IndexingStatus> }
  >();
  const tips = new Map<
    ChainRef,
    { readonly at: number; readonly reading: Promise<number> }
  >();
  const quotes = new Map<
    string,
    { readonly at: number; readonly reading: Promise<readonly FeeRate[]> }
  >();
  const reused = <Key, Value>(
    held: Map<Key, { readonly at: number; readonly reading: Promise<Value> }>,
    key: Key,
    ask: () => Promise<Value>,
  ): Promise<Value> => {
    const now = options.now().getTime();
    const kept = held.get(key);
    if (kept !== undefined && now - kept.at < options.ttlMs)
      return kept.reading;
    const reading = ask();
    held.set(key, { at: now, reading });
    reading.catch(() => {
      if (held.get(key)?.reading === reading) held.delete(key);
    });
    return reading;
  };
  return {
    balance: (chain, address) => observer.balance(chain, address),
    feeRates: (chain, targets) =>
      reused(quotes, `${chain}|${targets.join(",")}`, () =>
        observer.feeRates(chain, targets),
      ),
    indexing: (chain) =>
      reused(readings, chain, () => observer.indexing(chain)),
    observe: (ref) => observer.observe(ref),
    tip: (chain) => reused(tips, chain, () => observer.tip(chain)),
  };
}

// All that is needed of a chain's ports to judge delay: its observer, to ask how far the indexer has read. A service's own ports
// satisfy it, so nothing is adapted.
export type IndexingPorts = (chain: ChainRef) => {
  readonly observer: Pick<ChainObserver, "indexing">;
} | null;

// What the judge needs to know of a step or claim to say whether its wait is delayed.
export interface Waiter {
  readonly broadcastAt: Date | null;
  readonly chain: ChainRef;
  readonly state: TrackedState;
}

// Says which of a list of steps or claims are delayed (see `isDelayed`). The indexer is asked once for each chain that has a
// transaction waiting on it, and not at all when none is, so listing finished work costs the node nothing. Where a chain cannot be
// asked, its transactions are judged by the time alone.
export function createDelayJudge(options: {
  readonly now: () => Date;
  readonly ports: IndexingPorts;
  readonly policy: DelayPolicy;
}) {
  return async (waiters: readonly Waiter[]): Promise<readonly boolean[]> => {
    const waiting = waiters.map((waiter) => isWaiting(stageOf(waiter.state)));
    const chains = new Set(
      waiters.filter((_, index) => waiting[index]).map(({ chain }) => chain),
    );
    const statuses = new Map(
      await Promise.all(
        [...chains].map(
          async (chain) =>
            [
              chain,
              await readIndexing(options.ports(chain)?.observer ?? null, chain),
            ] as const,
        ),
      ),
    );
    const now = options.now();
    return waiters.map((waiter) =>
      isDelayed({
        now,
        policy: options.policy,
        sentAt: waiter.broadcastAt,
        stage: stageOf(waiter.state),
        status: statuses.get(waiter.chain) ?? null,
      }),
    );
  };
}
