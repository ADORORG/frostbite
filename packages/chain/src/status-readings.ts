import { createReadCache, type Aged, type ReadPolicy } from "@frostbite/cache";
import type {
  ChainRef,
  FeeRate,
  IndexingStatus,
} from "@frostbite/shared/chain";

import type { ChainObserver } from "./ports.ts";

// What a public status page may show of a chain, read from the node itself and not from the services' cache: the indexer's progress,
// the tip alone, and the fee market. All of it is the same for every visitor, so one reading serves everyone; and when the node is
// slow or down the last good reading is served for up to `policy.maxStaleMs`, each with when it was read, so a page can say how old
// it is. Past that nothing is served and the failure shows.
export interface StatusReadings {
  feeRates(targets: readonly number[]): Promise<Aged<readonly FeeRate[]>>;
  indexing(): Promise<IndexingStatus>;
  tipHeight(): Promise<number>;
}

export function createStatusReadings(
  observer: Pick<ChainObserver, "feeRates" | "indexing" | "tip">,
  chain: ChainRef,
  options: {
    readonly now: () => Date;
    readonly onRefreshFailed?: (key: string) => void;
    readonly policy: ReadPolicy;
  },
): StatusReadings {
  const readings = createReadCache<IndexingStatus>(options);
  const tips = createReadCache<number>(options);
  const quotes = createReadCache<readonly FeeRate[]>(options);
  return {
    feeRates: (targets) =>
      quotes.read(`fees|${targets.join(",")}`, () =>
        observer.feeRates(chain, targets),
      ),
    indexing: async () =>
      (await readings.read("indexing", () => observer.indexing(chain))).value,
    tipHeight: async () =>
      (await tips.read("tip", () => observer.tip(chain))).value,
  };
}
