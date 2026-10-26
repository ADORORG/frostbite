import type { FeeSource } from "./types.ts";

// A fee rate the operator has set, for every confirmation target, in place of asking an explorer. For when no explorer can be reached from
// where the platform runs; the rate is theirs to keep honest, so it is a setting they must choose, never a fallback taken when a source fails.
export function createFixedFeeSource(satPerVb: number): FeeSource {
  if (!Number.isFinite(satPerVb) || satPerVb <= 0)
    throw new Error("A fixed fee rate must be a positive number of sat/vB.");
  return {
    feeRates: async (targets) =>
      targets.map((target) => ({ satPerVb, targetBlocks: target })),
  };
}
