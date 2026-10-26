import type { FeeApiFormat } from "@ador/shared/chain";

import { createEsploraFeeSource, esploraProbeTargets } from "./esplora.ts";
import { createFixedFeeSource } from "./fixed.ts";
import { createMempoolFeeSource, mempoolProbeTargets } from "./mempool.ts";
import type { ExplorerOptions, FeeSource, FeeSourceSettings } from "./types.ts";

export type {
  ExplorerOptions,
  FeeSource,
  FeeSourceSettings,
  GetLike,
} from "./types.ts";

// The one place fee sources are known. A format is an adapter here, keyed by `feeApiFormats` (`@ador/shared/chain`), so a format cannot be
// configured without an adapter, nor an adapter exist without a name. To support another explorer: add its adapter file beside these, its
// name to `feeApiFormats`, and one entry to each of these two tables (the compiler refuses to build until both have it).
const explorerAdapters: Readonly<
  Record<FeeApiFormat, (options: ExplorerOptions) => FeeSource>
> = {
  esplora: createEsploraFeeSource,
  mempool: createMempoolFeeSource,
};
// What to ask for when looking at an explorer once, so every field the platform will later read is read.
const probeTargets: Readonly<Record<FeeApiFormat, readonly number[]>> = {
  esplora: esploraProbeTargets,
  mempool: mempoolProbeTargets,
};

export function createFeeSource(settings: FeeSourceSettings): FeeSource {
  return settings.kind === "fixed"
    ? createFixedFeeSource(settings.satPerVb)
    : explorerAdapters[settings.format](settings);
}

// Looks once at the explorer the operator named, reading every level the platform will use, so a wrong address, a wrong format or an
// answer of the wrong shape is found when the platform starts and not at someone's first step. Rejects as the adapter does. A fixed rate
// and no source have nothing to look at.
export async function probeFeeSource(
  settings: FeeSourceSettings | null,
): Promise<void> {
  if (settings === null || settings.kind !== "explorer") return;
  await createFeeSource(settings).feeRates(probeTargets[settings.format]);
}
