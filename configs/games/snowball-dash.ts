import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// SNOWBALL DASH: a one-button game. A snowball rolls down a 600 metre slope and the player hops it over the rocks. Every milestone is
// decided by the rules alone (`games/snowball-dash/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules
// as a verifier, the platform replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run
// followed the rules, not that a person played it. The digest pins the built file: a change to the rules is a change here, and a test
// fails until it is. Changing a goal changes the rules (and so the digest below) and is a new game version.
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

export const snowballDashGame = defineGame({
  capabilities: ["run:submit"],
  cover: {
    alt: "A white snowball with a cyan glint rolling down a snowy slope under a violet night sky, with two grey rocks ahead.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Roll down the slope. Press Enter or Space, or tap, to hop the snowball over the rocks. A run ends when you hit a rock or reach the foot of the slope, and every milestone is checked by replaying your run.",
  id: "snowball-dash",
  launch: { mode: "embedded" },
  milestones: [
    once("first-hop", "First hop", "Hop once.", "You made your first hop."),
    once(
      "rock-hopper",
      "Rock hopper",
      "Pass 5 rocks without hitting one.",
      "You passed five rocks.",
    ),
    once(
      "rock-master",
      "Rock master",
      "Pass 15 rocks without hitting one.",
      "You passed fifteen rocks.",
    ),
    once(
      "hundred-metres",
      "A hundred metres",
      "Roll 100 metres.",
      "You rolled a hundred metres.",
    ),
    once(
      "three-hundred-metres",
      "Halfway down",
      "Roll 300 metres.",
      "You rolled halfway down the slope.",
    ),
    once(
      "close-shave",
      "Close shave",
      "Clear a rock by no more than 2 units.",
      "You only just cleared a rock.",
    ),
    once(
      "daredevil",
      "Daredevil",
      "Clear 5 rocks by no more than 2 units each in one run.",
      "You only just cleared five rocks.",
    ),
    once(
      "full-speed",
      "Full speed",
      "Reach the top speed (300 metres down).",
      "You rolled as fast as the slope allows.",
    ),
    once(
      "foot-of-the-slope",
      "Foot of the slope",
      "Reach the end of the 600 metre slope.",
      "You rolled all the way down.",
    ),
    once(
      "tidy-run",
      "Tidy run",
      "Reach the end having hopped no more often than there are rocks.",
      "You reached the end without a wasted hop.",
    ),
  ],
  network: betaTarget.chainId,
  scene: "runner",
  schemaVersion: 1,
  summary: "Hop a rolling snowball over the rocks, all the way down the slope.",
  title: "Snowball Dash",
  verification: {
    replay: {
      id: "snowball-dash",
      sha256:
        "90080ca534ee16c3d63f7b20022cb50b2dc82931bdae401cebe3b09dc74972b6",
      version: 1,
    },
  },
  version: "0.1.0",
});
