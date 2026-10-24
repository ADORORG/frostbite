import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// Tap Tower, the sample game in /games/sample-game. It exists to prove the host: it is played in the isolated
// frame, saves through the platform and unlocks milestones. It is registered only where the platform is run
// for development or tests (see configs/games.ts), never in a deployment players use.
export const sampleGame = defineGame({
  capabilities: [],
  description:
    "Tap to score. Reaching 5 and 10 taps unlocks a milestone, which the platform remembers for you.",
  id: "sample-game",
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
  title: "Tap Tower",
  version: "0.1.0",
});
