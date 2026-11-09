import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// Tap Counter, in /games/fixture-taps: a small game that exists so that tests and the landing page never depend on a real one. It is
// registered only where the platform is run for development or tests (see configs/games.ts), never in a deployment players use, so adding
// or removing a real game cannot break a test that needs "a game". It keeps the starter's rules: a tap adds one, and 5 and 10 taps are its
// two milestones (self-reported, with no replay verifier and no rewards contract: nothing here needs them).
export const fixtureTapsGame = defineGame({
  capabilities: [],
  description:
    "Tap to score. Reaching 5 and 10 taps unlocks a milestone, which the platform remembers for you.",
  id: "fixture-taps",
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
  summary: "A tapping game the platform's own tests play.",
  // A kind of game as well, so the browser tests have a filter chip that finds it.
  tags: ["developer", "puzzle"],
  title: "Tap Counter",
  version: "0.1.0",
});
