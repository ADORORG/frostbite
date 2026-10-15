import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [signet] = targetChains;
if (signet === undefined) throw new Error("No target chain is configured.");

// FROST·BITE, the first game, played by the platform itself in the isolated frame (/games/frostbite, source in
// /games/frostbite). It runs as a simulation: nothing in it touches a chain or a server, and the page says so.
// Its milestones are three of the game's own progression marks, approved by the owner on 2026-10-12; the game reports a
// mark only when a milestone of the same name is declared here (`first-win` for its `firstWin`), so declaring another is
// the whole change. They are the game's own report, and nothing of value depends on them.
//
// Two of them (`first-win`, `first-glacier`) can also be replay-checked. The game publishes the rules of its ice-field
// cabinet (`games/frostbite/src/replay.ts`), the platform replays a run it issued a seed for, and the milestone is then
// held as replay-verified. That shows the run followed the rules, not that a person played it, and the cabinet's board
// is one a browser that knows the seed can read. `first-cashout` is a simulation event no replay can decide, so it stays
// the game's report. The digest pins the built file: a change to the rules is a change here, and a test fails until it is.
export const frostbite = defineGame({
  capabilities: ["run:submit"],
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
      verification: "replay-verified",
    },
    {
      claimPolicy: "once",
      criteria: "Build a glacier from your icicles.",
      description: "You built your first glacier.",
      id: "first-glacier",
      title: "First glacier",
      verification: "replay-verified",
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
  verification: {
    replay: {
      id: "ice-field",
      sha256:
        "899c429d932e38b6f5d2cba4df556b500524524942cb3bce13aaf7041cc765b4",
      version: 1,
    },
  },
  version: "0.3.0",
});
