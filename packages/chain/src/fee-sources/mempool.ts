import type { FeeRate } from "@frostbite/shared/chain";

import {
  assertTimeout,
  badShape,
  getExplorerJson,
  isRecord,
  positiveRate,
} from "./explorer-http.ts";
import type { ExplorerOptions, FeeSource } from "./types.ts";

// mempool.space's recommended fees (https://mempool.space/docs/api/rest#get-recommended-fees): the next block, about half an hour (three
// blocks), about an hour (six blocks), and "economy" (anything slower).
const path = "/api/v1/fees/recommended";
const levels = [
  { field: "fastestFee", upToBlocks: 1 },
  { field: "halfHourFee", upToBlocks: 3 },
  { field: "hourFee", upToBlocks: 6 },
] as const;
const slowest = "economyFee";

// One target for each level the explorer names, so a look at the answer reads every field the platform will later use.
const levelTargets = levels.map(({ upToBlocks }) => upToBlocks);
export const mempoolProbeTargets: readonly number[] = [
  ...levelTargets,
  Math.max(...levelTargets) + 1,
];

const fieldFor = (target: number): string =>
  levels.find((level) => target <= level.upToBlocks)?.field ?? slowest;

export function createMempoolFeeSource(options: ExplorerOptions): FeeSource {
  assertTimeout(options.timeoutMs);
  return {
    feeRates: async (targets): Promise<readonly FeeRate[]> => {
      const fees = await getExplorerJson(options, path);
      if (!isRecord(fees)) throw badShape("a fee recommendation");
      return targets.map((target) => ({
        satPerVb: positiveRate(fees[fieldFor(target)], fieldFor(target)),
        targetBlocks: target,
      }));
    },
  };
}
