import type { ChainConfig, FundingPolicy } from "@ador/shared/chain";

import { nativeAsset } from "./bitcoin-alkanes/chains.ts";
import {
  createAlkanesAdapter,
  type AlkanesChainSettings,
} from "./bitcoin-alkanes/settings.ts";
import type { ChainAdapter } from "./adapter.ts";
import { createChainRegistry, type ChainRegistry } from "./registry.ts";

export { probeFeeSource } from "./bitcoin-alkanes/settings.ts";
export type { GetLike } from "./bitcoin-alkanes/node/fee-api.ts";
export type { FetchLike } from "./bitcoin-alkanes/node/transport.ts";
export type {
  AlkanesAdministrationSettings,
  AlkanesChainSettings,
  FeeSourceSettings,
  TemplateSetting,
} from "./bitcoin-alkanes/settings.ts";

// The settings of a chain's family adapter. A family is added by adding its settings here and its cases below; nothing that uses
// the registry changes.
export type AdapterSettings = {
  readonly kind: "bitcoin-alkanes";
  readonly settings: AlkanesChainSettings;
};

// A chain the platform is configured for: its record, and the settings of its family's adapter.
export interface ConfiguredChain {
  readonly adapter: AdapterSettings;
  readonly config: ChainConfig;
}

function adapterOf({ adapter }: ConfiguredChain): ChainAdapter {
  switch (adapter.kind) {
    case "bitcoin-alkanes":
      return createAlkanesAdapter(adapter.settings);
  }
}

// The registry over the chains the platform is configured for. Everything outside this package reaches a chain through it, by its
// neutral ports.
export function createConfiguredRegistry(
  chains: readonly ConfiguredChain[],
): ChainRegistry {
  return createChainRegistry({
    adapters: chains.map(adapterOf),
    chains: chains.map(({ config }) => config),
  });
}

// The most a transaction may pay in fee, in the smallest unit of the chain's own currency.
export function feeCeiling(
  { adapter, config }: ConfiguredChain,
  baseUnits: bigint,
): FundingPolicy {
  switch (adapter.kind) {
    case "bitcoin-alkanes":
      return { maxFee: { asset: nativeAsset(config.chainId), baseUnits } };
  }
}
