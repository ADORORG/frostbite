import type { GameClaimsConfig } from "@frostbite/feature-games";

import { rewardsChain } from "./game-rewards.ts";
import { rewardsPolicy } from "./rewards-policy.ts";

// What the platform needs to take claims of games' milestones on chain (see `game-rewards.ts`).
export const gameClaimsConfig = {
  chain: rewardsChain,
  delay: rewardsPolicy.delay,
} satisfies GameClaimsConfig;
