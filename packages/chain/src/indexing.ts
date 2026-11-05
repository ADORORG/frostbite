import { createReadCache } from "@frostbite/cache";
import {
  isDelayed,
  isWaiting,
  stageOf,
  type ChainRef,
  type DelayPolicy,
  type FeeRate,
  type IndexingStatus,
  type TrackedState,
} from "@frostbite/shared/chain";

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

// An observer that asks the chain how far its indexer has read, where its tip is and what its fee market quotes at most once in `ttlMs`,
// however many ask: every page shows these, so uncached each would be a request to the node per visitor. Callers that arrive while a
// reading is on its way share it, and a failed reading is never kept, so the next caller asks again. Nothing older than `ttlMs` is
// served, because services judge a wait by it; what a public page may show of an older reading is `createStatusReadings`.
export function cacheIndexing(
  observer: ChainObserver,
  options: { readonly now: () => Date; readonly ttlMs: number },
): ChainObserver {
  const { now, ttlMs } = options;
  const policy = { freshMs: ttlMs, maxStaleMs: ttlMs };
  const readings = createReadCache<IndexingStatus>({ now, policy });
  const tips = createReadCache<number>({ now, policy });
  const quotes = createReadCache<readonly FeeRate[]>({ now, policy });
  return {
    balance: (chain, address) => observer.balance(chain, address),
    feeRates: async (chain, targets) =>
      (
        await quotes.read(`${chain}|${targets.join(",")}`, () =>
          observer.feeRates(chain, targets),
        )
      ).value,
    indexing: async (chain) =>
      (await readings.read(chain, () => observer.indexing(chain))).value,
    observe: (ref) => observer.observe(ref),
    tip: async (chain) =>
      (await tips.read(chain, () => observer.tip(chain))).value,
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
