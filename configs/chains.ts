import type { BetaNetwork, ChainOption } from "@ador/shared/chain";
import { parseBetaNetworkEnvironment } from "@repo/config/beta-network";

import { betaChains, type BetaChain } from "./beta-chains.ts";

// The ids stay importable from here, where the rest of the platform has always found them.
export {
  betaChains,
  bitcoinSignetChainId,
  bitcoinTestnet4ChainId,
  type BetaChain,
} from "./beta-chains.ts";

// The one test network this deployment runs on, from `BETA_NETWORK` (blank: signet; ADR-008 keeps mainnet behind its own readiness
// gate). The wallet network, the games' chain, collections' target chain and the rewards chain all follow it. Games and data made
// on the other network stay on it.
export const betaNetwork: BetaNetwork = parseBetaNetworkEnvironment(
  process.env,
);
export const betaChain: BetaChain = betaChains[betaNetwork];

// The chains a collection draft may target in the beta. This is the projection of `ChainConfig` that
// needs no confirmation policy; the full records, with per-operation finality, arrive when D22 is
// accepted (W7-00) and this list is then derived from them.
export const targetChains: readonly ChainOption[] = [betaChain.chain];
