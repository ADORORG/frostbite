import { feeAdapters } from "./adapters.ts";
import { withFallback } from "./fallback.ts";
import type { FeeSource, FeeSourceSettings } from "./types.ts";

export type {
  ExplorerOptions,
  FeeAdapter,
  FeeSource,
  FeeSourceSettings,
  GetLike,
} from "./types.ts";

function explorerOf(settings: FeeSourceSettings): FeeSource {
  const adapter = feeAdapters[settings.adapter];
  return adapter.create({
    fetch: settings.fetch,
    timeoutMs: settings.timeoutMs,
    url: adapter.links[settings.network],
  });
}

// The fee source the settings name: the chosen explorer, with the operator's rate taken in its place where it cannot be read.
export function createFeeSource(settings: FeeSourceSettings): FeeSource {
  const explorer = explorerOf(settings);
  return settings.fallbackSatPerVb === null
    ? explorer
    : withFallback(
        explorer,
        settings.fallbackSatPerVb,
        settings.onFallback ?? (() => {}),
      );
}

// Looks once at the chosen explorer (without the fallback), reading every level the platform will use, so a wrong answer is found when the
// platform starts. Rejects as the adapter does.
export async function probeFeeSource(
  settings: FeeSourceSettings,
): Promise<void> {
  await explorerOf(settings).feeRates(
    feeAdapters[settings.adapter].probeTargets,
  );
}
