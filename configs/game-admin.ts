import type { GameAdminConfig } from "@frostbite/feature-game-admin";

import { betaChain } from "./chains.ts";
import { rewardsChain } from "./game-rewards.ts";
import { rewardsPolicy } from "./rewards-policy.ts";
import { rewardsPlan } from "./rewards-plan.ts";

// What the platform needs to let staff administer games' rewards contracts (see `game-rewards.ts`), and the limits a milestone's
// drawing is held to. The byte limit is each contract's own (what it was created to accept, on record); the rest bound how much
// work a drawing can cost the page that shows it.
export const gameAdminConfig = {
  chain: rewardsChain,
  delay: rewardsPolicy.delay,
  explorerTxUrl: betaChain.explorerTxUrl,
  fees: {
    defaultSpeed: rewardsPolicy.defaultFeeSpeed,
    polling: rewardsPolicy.statusPolling,
  },
  platformFee: { maximumSats: rewardsPolicy.maxPlatformFeeSats },
  drawingLimits: {
    maxAttributeLength: 4096,
    maxDepth: 8,
    maxElements: 200,
  },
  rewards: rewardsPlan,
  signingWallets: rewardsPolicy.signingWallets,
} satisfies GameAdminConfig;
