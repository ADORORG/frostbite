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

// The ladders. Their ids are the ones in `games/snowball-dash/src/rules/milestones.ts`, which holds the numbers: a test fails if the two
// lists of ids differ. A mark is every 25 metres; the 300 metre mark is the top speed, earned as "full-speed".
const rocks = [
  ["first-rock", "First rock", "1 rock"],
  ["three-rocks", "Three rocks", "3 rocks"],
  ["rock-hopper", "Rock hopper", "5 rocks"],
  ["eight-rocks", "Eight rocks", "8 rocks"],
  ["ten-rocks", "Ten rocks", "10 rocks"],
  ["twelve-rocks", "A dozen rocks", "12 rocks"],
  ["rock-master", "Rock master", "14 rocks"],
] as const;
const closeCalls = [
  ["close-shave", "Close shave", "1 rock"],
  ["three-close", "Three close shaves", "3 rocks"],
  ["daredevil", "Daredevil", "5 rocks"],
  ["eight-close", "Eight close shaves", "8 rocks"],
] as const;
const topSpeedMark = 300;
const marks = Array.from({ length: 23 }, (_, index) => (index + 1) * 25);

export const snowballDashGame = defineGame({
  capabilities: ["run:submit"],
  cover: {
    alt: "A white snowball with a cyan glint rolling down a snowy slope under a violet night sky, with two grey rocks ahead.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Roll down the slope. Press Enter or Space, or tap, to hop the snowball over the rocks. A run ends when you hit a rock or reach the foot of the slope. Forty milestones, from your first hop to a run that cuts eight rocks fine, are each checked by replaying your run.",
  id: "snowball-dash",
  launch: { mode: "embedded" },
  milestones: [
    once("first-hop", "First hop", "Hop once.", "You made your first hop."),
    ...rocks.map(([id, title, count]) =>
      once(
        id,
        title,
        `Pass ${count} without hitting one.`,
        `You passed ${count}.`,
      ),
    ),
    ...marks.map((metres) =>
      metres === topSpeedMark
        ? once(
            "full-speed",
            "Full speed",
            `Reach the top speed (${metres} metres down).`,
            "You rolled as fast as the slope allows.",
          )
        : once(
            `metres-${metres}`,
            `${metres} metres`,
            `Roll ${metres} metres.`,
            `You rolled ${metres} metres.`,
          ),
    ),
    ...closeCalls.map(([id, title, count]) =>
      once(
        id,
        title,
        `Clear ${count} by no more than 2 units each in one run.`,
        `You only just cleared ${count}.`,
      ),
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
    once(
      "comfortable-run",
      "Smooth roll",
      "Reach the end without a single close shave.",
      "You rolled down with room to spare at every rock.",
    ),
    once(
      "sharp-finish",
      "Sharp finish",
      "Reach the end having cleared 5 or more rocks by no more than 2 units.",
      "You reached the end living on the edge.",
    ),
    once(
      "razor-finish",
      "Razor's edge",
      "Reach the end having cleared 8 or more rocks by no more than 2 units.",
      "You reached the end by a hair, again and again.",
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
        "41ff9e05dca5ebaae0c94da951f2366cab391fbc2196487ddec159ecdd835014",
      version: 1,
    },
  },
  version: "0.1.0",
});
