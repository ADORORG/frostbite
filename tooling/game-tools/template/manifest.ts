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

// The starter game's manifest, the template `pnpm game:new` copies (see tooling/game-tools). It is never registered itself: a new game gets
// its own copy, with its own id and title, and one line in configs/games.ts. The digest below is a placeholder that `game:new` replaces with
// the digest of the verifier it built.
export const starterGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  description:
    "Catch the marker as it sweeps the lane. Every catch scores and speeds it up; a miss ends the run. Every milestone is checked by replaying your run.",
  id: "starter-game",
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
  title: "Starter Game",
  verification: {
    replay: {
      id: "starter-game",
      sha256:
        "0000000000000000000000000000000000000000000000000000000000000000",
      version: 1,
    },
  },
  version: "0.1.0",
});
