import type { GameAdminConfig } from "@ador/feature-game-admin";

import { rewardsChain, rewardsContracts } from "./game-rewards.ts";

// What the platform needs to let staff administer games' rewards contracts (see `game-rewards.ts`), and the limits a milestone's
// drawing is held to. The byte limit is each contract's own (`max_art_bytes`, set when the contract is created), so it is listed
// per game when the contract is; the rest bound how much work a drawing can cost the page that shows it.
export const gameAdminConfig = {
  chain: rewardsChain,
  contracts: rewardsContracts,
  drawingLimits: {
    maxAttributeLength: 4096,
    maxDepth: 8,
    maxElements: 200,
  },
  maxDrawingBytes: new Map(),
} satisfies GameAdminConfig;
