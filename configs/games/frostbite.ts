import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [signet] = targetChains;
if (signet === undefined) throw new Error("No target chain is configured.");

// FROST·BITE, the first game. Registered with no play address: its configurable play address, base path and
// return address arrive with W8-02, so until then the catalog says it cannot be played yet. It declares no
// capabilities and no milestones, because the host protocol and the milestone claim path do not exist yet
// (GP-02, GP-07) and nothing may be declared that the platform cannot honour.
export const frostbite = defineGame({
  capabilities: [],
  description:
    "Read the board, call the next move, and keep your streak alive.",
  id: "frostbite",
  launch: { mode: "external", url: null },
  milestones: [],
  network: signet.chainId,
  schemaVersion: 1,
  summary: "A predictive minefield game on Bitcoin.",
  title: "FROST·BITE",
  version: "0.1.0",
});
