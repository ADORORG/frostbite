import type { ContractRef } from "@ador/shared/chain";

// Where the games' rewards contracts are and which chain the platform builds, sends and watches transactions on, for players'
// claims and for staff's administration alike: one place, so the two cannot disagree. Neither exists yet (the real chain adapter's
// network, funding and the deployed contracts are configured when the mainnet review opens; signet comes first), so nothing is
// configured, and claims and administration answer "not available". Deploying a contract for a game is adding it to `contracts`;
// nothing else changes.
export const rewardsChain = () => null;
export const rewardsContracts: ReadonlyMap<string, ContractRef> = new Map();
