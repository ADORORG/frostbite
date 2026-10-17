import type { GameClaimsConfig } from "@ador/feature-games";

import { rewardsChain } from "./game-rewards.ts";

// What the platform needs to take claims of games' milestones on chain (see `game-rewards.ts`).
export const gameClaimsConfig = {
  chain: rewardsChain,
} satisfies GameClaimsConfig;
