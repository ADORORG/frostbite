import type { GameClaimsConfig } from "@ador/feature-games";

// What the platform needs to take claims of games' milestones on chain: the rewards contract deployed for each game, and a chain
// it can build, send and watch transactions on. Neither exists yet (the contract and the real chain adapter are G7e, waiting on
// the administration and confirmation decisions and a wallet that can sign), so nothing is configured, and every claim is
// answered "not available". Deploying a contract for a game is adding it here; nothing else changes.
export const gameClaimsConfig = {
  chain: () => null,
  contracts: new Map(),
} satisfies GameClaimsConfig;
