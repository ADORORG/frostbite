import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

import { parseRewardsChainEnvironment } from "@repo/config/rewards-chain";

import { createRewardsChain } from "./rewards-chain.ts";

// The chain the platform builds, sends and watches transactions on, for players' claims and for staff's administration alike: one
// place, so the two cannot disagree. It comes from the deployment's `REWARDS_*` settings (see `.env.example`); with no node address
// set there is no chain, and claims and administration answer "not available". Where the games' contracts are is not here: it is
// on record once staff have created each (`ador.game_contracts`).
const rewards = createRewardsChain(parseRewardsChainEnvironment(process.env), {
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
  random: (length) => new Uint8Array(randomBytes(length)),
  readFile,
});

export const rewardsChain = rewards?.chain ?? (() => null);

// The same chain as anyone may see how far its indexer has read (the lamp in every page's header); none where no chain is configured.
export const followedRewardsChain = rewards?.followed ?? null;
