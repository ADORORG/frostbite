import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [signet] = targetChains;
if (signet === undefined) throw new Error("No target chain is configured.");

// FROST·BITE, the first game, played by the platform itself in the isolated frame (/games/frostbite, source in
// /games/frostbite). It runs as a simulation: nothing in it touches a chain or a server, and the page says so.
// It declares no capabilities, because none is granted yet. It declares no milestones until the owner approves
// which of the game's own marks count; the game reports a mark only when a milestone of the same name is
// declared here (`first-win` for its `firstWin`), so declaring one is the whole change.
export const frostbite = defineGame({
  capabilities: [],
  description:
    "Read the board, call the next move, and keep your streak alive.",
  id: "frostbite",
  launch: { mode: "embedded" },
  milestones: [],
  network: signet.chainId,
  schemaVersion: 1,
  summary: "A predictive minefield game on Bitcoin.",
  title: "FROST·BITE",
  version: "0.2.0",
});
