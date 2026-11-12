import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

const once = (
  id: string,
  title: string,
  criteria: string,
  description: string,
) =>
  ({
    claimPolicy: "once",
    criteria,
    description,
    id,
    title,
    verification: "replay-verified",
  }) as const;

// Permafrost, started from the template. Replace the description, summary, tags and milestones; a milestone's id
// must be one the game's code asks the platform to unlock.
export const permafrostGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  description:
    "Catch the marker as it sweeps the lane. Every catch scores and speeds it up; a miss ends the run. Every milestone is checked by replaying your run.",
  id: "permafrost",
  launch: { mode: "embedded" },
  milestones: [
    once("first-catch", "First catch", "Catch 1.", "You caught the marker."),
    once("first-five", "First five", "Catch 5.", "Five catches in one run."),
    once("ten-catches", "Ten catches", "Catch 10.", "Ten catches in one run."),
    once(
      "twenty-five",
      "Twenty-five catches",
      "Catch 25.",
      "Twenty-five catches in one run.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary: "Catch the marker in the zone, again and again, as it speeds up.",
  tags: ["arcade"],
  title: "Permafrost",
  verification: {
    replay: {
      id: "permafrost",
      sha256:
        "3aa15a167a07383b4d37665bbe4fccccc4d0748cc12ee30a7d07141d0438ad58",
      version: 1,
    },
  },
  version: "0.1.0",
});
