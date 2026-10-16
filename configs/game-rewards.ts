import { readFile } from "node:fs/promises";

import { parseRewardsChainEnvironment } from "@repo/config/rewards-chain";
import { randomBytes } from "node:crypto";

import { createRewardsChain } from "./rewards-chain.ts";

// Where the games' rewards contracts are and which chain the platform builds, sends and watches transactions on, for players'
// claims and for staff's administration alike: one place, so the two cannot disagree. It comes from the deployment's `REWARDS_*`
// settings (see `.env.example`); with no node address set there is no chain, and claims and administration answer "not
// available". While the release gate is closed the chain is configured but not offered. Deploying a contract for a game is
// adding it to `REWARDS_CONTRACTS`; nothing else changes.
const rewards = createRewardsChain(parseRewardsChainEnvironment(process.env), {
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
  random: (length) => new Uint8Array(randomBytes(length)),
  readFile,
});

export const rewardsChain = rewards?.chain ?? (() => null);
export const rewardsContracts = rewards?.contracts ?? new Map();
export const rewardsMaxDrawingBytes = rewards?.maxDrawingBytes ?? new Map();
