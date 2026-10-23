import type { ChainStatusConfig } from "@ador/feature-chain-status";

import { followedRewardsChain } from "./game-rewards.ts";
import { rewardsPolicy } from "./rewards-policy.ts";

// Which chain's indexer the header lamp reports on (the rewards chain), what counts as far behind, and how often a page asks again.
export const chainStatusConfig = {
  delay: rewardsPolicy.delay,
  feeSpeeds: rewardsPolicy.feeSpeeds,
  followed: followedRewardsChain,
  refreshMs: rewardsPolicy.indexingRefreshMs,
} satisfies ChainStatusConfig;
