import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// FROST·BITE, the first game, played by the platform itself in the isolated frame (/games/frostbite, source in
// /games/frostbite). It runs as a simulation: nothing in it touches a chain or a server, and the page says so.
// Its milestones are three of the game's own progression marks, approved by the owner on 2026-10-12; the game reports a
// mark only when a milestone of the same name is declared here (`first-win` for its `firstWin`), so declaring another is
// the whole change. They are the game's own report, and nothing of value depends on them.
//
// Three of the game's milestones can also be replay-checked: `first-win` and `first-glacier` from the ice-field cabinet and
// `snake-ten` from SAT SNAKE. The game publishes the rules of those cabinets as one verifier
// (`games/frostbite/src/replay.ts`), the platform replays a run it issued a seed for, and the milestone is then held as
// replay-verified. That shows the run followed the rules, not that a person played it. The ice field's board is one a
// browser that knows the seed can read; SAT SNAKE hides nothing, but a program could still steer it. `first-cashout` is a simulation event no replay can decide, so it stays
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
      criteria: "Grow the snake to ten links in the SAT SNAKE cabinet.",
      description: "You grew the sat snake to ten links.",
      id: "snake-ten",
      title: "Ten links",
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
  network: betaTarget.chainId,
  schemaVersion: 1,
  summary: "A predictive minefield game on Bitcoin.",
  title: "FROST·BITE",
  verification: {
    replay: {
      id: "frostbite",
      sha256:
        "09fb43aa50ef14d416f73a7e6b88d70400d437ea875a5ecbe3bf29ee2df51096",
      version: 2,
    },
  },
  version: "0.4.0",
});
