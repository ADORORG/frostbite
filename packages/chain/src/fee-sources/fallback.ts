import { ChainUnavailableError } from "../ports.ts";
import { createFixedFeeSource } from "./fixed.ts";
import type { FeeSource } from "./types.ts";

// Takes the operator's rate for every target when the source cannot be read (unreachable, or an answer that is not a fee table), and says
// why each time. Only that: a mistake in the code or the settings is not an outage and is not hidden.
export function withFallback(
  source: FeeSource,
  satPerVb: number,
  onFallback: (reason: string) => void,
): FeeSource {
  const fixed = createFixedFeeSource(satPerVb);
  return {
    feeRates: async (targets) => {
      try {
        return await source.feeRates(targets);
      } catch (error) {
        if (!(error instanceof ChainUnavailableError)) throw error;
        onFallback(error.message);
        return fixed.feeRates(targets);
      }
    },
  };
}
