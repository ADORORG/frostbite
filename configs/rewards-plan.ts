import type { RewardsPlan } from "@ador/game-admin";
import { chainRefSchema } from "@ador/shared/chain";

import { betaChain } from "./chains.ts";
import { rewardsPolicy } from "./rewards-policy.ts";

const chain = chainRefSchema.parse(betaChain.chain.chainId);

const [gameTemplate, collectibleTemplate] = rewardsPolicy.templates.map(
  ({ crate, version }) => ({ id: crate, version }),
);
if (gameTemplate === undefined || collectibleTemplate === undefined)
  throw new Error(
    "The rewards policy lists the game and collectible templates.",
  );

// What the platform has decided about its rewards chain, for staff administration: the chain, the templates it may publish, which of
// them a game and its collectibles are made from, and the most a game's contract may be created to accept. Where a template or a
// contract is on the chain is recorded when staff publish or create it, not configured.
export const rewardsPlan: RewardsPlan = {
  chain,
  collectibleTemplate,
  family: betaChain.chain.family,
  gameTemplate,
  maxDrawingBytes: rewardsPolicy.maxDrawingBytes,
  publishable: [gameTemplate, collectibleTemplate],
};
