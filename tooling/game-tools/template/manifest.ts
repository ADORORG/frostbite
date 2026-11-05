import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// The starter game's manifest, the template `pnpm game:new` copies (see tooling/game-tools). It is never registered itself: a new game gets
// its own copy, with its own id and title, and one line in configs/games.ts.
export const starterGame = defineGame({
  capabilities: [],
  description:
    "Tap to score. Reaching 5 and 10 taps unlocks a milestone, which the platform remembers for you.",
  id: "starter-game",
  launch: { mode: "embedded" },
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Score 5 taps.",
      description: "Five taps in one run.",
      id: "first-five",
      title: "First five",
    },
    {
      claimPolicy: "once",
      criteria: "Score 10 taps.",
      description: "Ten taps in one run.",
      id: "ten-taps",
      title: "Ten taps",
    },
  ],
  network: betaTarget.chainId,
  schemaVersion: 1,
  summary: "A tiny tapping game that shows how a game talks to the platform.",
  tags: ["arcade"],
  title: "Starter Game",
  version: "0.1.0",
});
