import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [signet] = targetChains;
if (signet === undefined) throw new Error("No target chain is configured.");

// FROST·BITE, the first game. Registered with no play address of its own: a deployment sets where it is played,
// its base path, its return address and its network in `GAME_LAUNCHES` (see configs/games.ts), and until it
// does the catalog says it cannot be played yet. It declares no
// capabilities and no milestones, because the host protocol and the milestone claim path do not exist yet
// (GP-02, GP-07) and nothing may be declared that the platform cannot honour.
export const frostbite = defineGame({
  capabilities: [],
  description:
    "Read the board, call the next move, and keep your streak alive.",
  id: "frostbite",
  launch: { basePath: "", mode: "external", returnUrl: null, url: null },
  milestones: [],
  network: signet.chainId,
  schemaVersion: 1,
  summary: "A predictive minefield game on Bitcoin.",
  title: "FROST·BITE",
  version: "0.1.0",
});
