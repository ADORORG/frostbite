import type { FeeSource } from "./types.ts";

// A fee rate the operator has set, for every confirmation target. It stands in where the chosen explorer cannot be read (`withFallback`); the
// rate is theirs to keep honest.
export function createFixedFeeSource(satPerVb: number): FeeSource {
  if (!Number.isFinite(satPerVb) || satPerVb <= 0)
    throw new Error("A fixed fee rate must be a positive number of sat/vB.");
  return {
    feeRates: async (targets) =>
      targets.map((target) => ({ satPerVb, targetBlocks: target })),
  };
}
