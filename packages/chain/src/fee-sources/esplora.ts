import type { FeeRate } from "@frostbite/shared/chain";

import {
  assertTimeout,
  badShape,
  getExplorerJson,
  isRecord,
  positiveRate,
} from "./explorer-http.ts";
import type { ExplorerOptions, FeeSource } from "./types.ts";

// The Esplora standard's fee estimates (https://github.com/Blockstream/esplora/blob/master/API.md#get-fee-estimates): a map from a
// confirmation target in blocks to a rate in sat/vB, with targets such as 1 to 25, 144, 504 and 1008.
const path = "/api/fee-estimates";

// One target for each end of what the platform asks, so a look at the answer reads what it will later use.
export const esploraProbeTargets: readonly number[] = [1, 3, 6, 7];

export function createEsploraFeeSource(options: ExplorerOptions): FeeSource {
  assertTimeout(options.timeoutMs);
  return {
    feeRates: async (targets): Promise<readonly FeeRate[]> => {
      const answer = await getExplorerJson(options, path);
      if (!isRecord(answer)) throw badShape("a map of fee estimates");
      const estimates = Object.entries(answer)
        .map(([blocks, rate]) => ({
          blocks: Number(blocks),
          rate: positiveRate(rate, `estimate for ${blocks} blocks`),
        }))
        .filter(({ blocks }) => Number.isInteger(blocks) && blocks > 0)
        .sort((left, right) => left.blocks - right.blocks);
      const slowest = estimates.at(-1);
      if (slowest === undefined) throw badShape("a map of fee estimates");
      // The estimate for the nearest target at or beyond the one asked about (confirming within more blocks is never dearer), and for the
      // slowest target the explorer has when the one asked about is slower than any it quotes.
      return targets.map((target) => ({
        satPerVb: (estimates.find(({ blocks }) => blocks >= target) ?? slowest)
          .rate,
        targetBlocks: target,
      }));
    },
  };
}
