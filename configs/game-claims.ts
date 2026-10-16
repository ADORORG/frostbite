import type { GameClaimsConfig } from "@ador/feature-games";

import { rewardsChain, rewardsContracts } from "./game-rewards.ts";

// What the platform needs to take claims of games' milestones on chain (see `game-rewards.ts`).
export const gameClaimsConfig = {
  chain: rewardsChain,
  contracts: rewardsContracts,
} satisfies GameClaimsConfig;
