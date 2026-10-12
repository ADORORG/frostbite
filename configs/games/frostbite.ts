import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [signet] = targetChains;
if (signet === undefined) throw new Error("No target chain is configured.");

// FROST·BITE, the first game, played by the platform itself in the isolated frame (/games/frostbite, source in
// /games/frostbite). It runs as a simulation: nothing in it touches a chain or a server, and the page says so.
// It declares no capabilities, because none is granted yet. Its milestones are three of the game's own progression
// marks, approved by the owner on 2026-10-12; the game reports a mark only when a milestone of the same name is
// declared here (`first-win` for its `firstWin`), so declaring another is the whole change. They are the game's
// own report: the platform cannot see inside the game, and nothing of value depends on them.
export const frostbite = defineGame({
  capabilities: [],
  cover: {
    alt: "A glacier rising over a board of ice tiles, with a few red mines hidden among them.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Read the board, call the next move, and keep your streak alive.",
  id: "frostbite",
  launch: { mode: "embedded" },
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Win a board.",
      description: "You won your first board.",
      id: "first-win",
      title: "First win",
    },
    {
      claimPolicy: "once",
      criteria: "Build a glacier from your icicles.",
      description: "You built your first glacier.",
      id: "first-glacier",
      title: "First glacier",
    },
    {
      claimPolicy: "once",
      criteria: "Cash out your icicles.",
      description: "You cashed out for the first time.",
      id: "first-cashout",
      title: "First cash-out",
    },
  ],
  network: signet.chainId,
  schemaVersion: 1,
  summary: "A predictive minefield game on Bitcoin.",
  title: "FROST·BITE",
  version: "0.2.0",
});
