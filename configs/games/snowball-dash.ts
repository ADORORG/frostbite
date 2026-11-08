import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// SNOWBALL DASH: a one-button game. A snowball rolls down an endless slope, faster and faster, and the player hops it over rocks, boulders,
// spikes and crevasses: a tap is a short hop, a hold a high one. Shards are worth taking, and cutting an obstacle fine builds a multiplier. Every milestone is
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
// lists of ids differ. Each rung is earned within one run.
const rung = (
  prefix: string,
  step: number,
  title: string,
  criteria: string,
  description: string,
) => once(`${prefix}-${String(step)}`, title, criteria, description);
const words = (count: number, one: string, many: string) =>
  `${String(count)} ${count === 1 ? one : many}`;
const score = [500, 1_500, 3_000, 6_000, 12_000, 25_000, 50_000, 100_000];
const metres = [100, 250, 500, 800, 1_200, 2_000];
const shards = [10, 25, 50, 100, 200];
const clears = [10, 25, 50, 100];
const kinds = [
  ["boulders", "boulder", "boulders"],
  ["pits", "crevasse", "crevasses"],
  ["spikes", "row of spikes", "rows of spikes"],
] as const;
const streaks = [2, 4, 6];

export const snowballDashGame = defineGame({
  capabilities: ["run:submit"],
  cover: {
    alt: "A white snowball with a cyan glint rolling down a snowy slope under a violet night sky, with two grey rocks ahead.",
    image: "cover.svg",
    video: null,
  },
  description:
    "An endless slope, getting faster. Tap to hop, hold to go higher: clear rocks, boulders, spikes and crevasses, grab the shards, and cut things fine to build a score multiplier. A run ends when you hit something or fall in. Forty milestones, from your first hop to a six-in-a-row streak and a hundred thousand point run, are each checked by replaying your run.",
  id: "snowball-dash",
  launch: { mode: "embedded" },
  milestones: [
    once("first-hop", "First hop", "Hop once.", "You made your first hop."),
    ...score.map((step) =>
      rung(
        "score",
        step,
        `${step.toLocaleString("en-US")} points`,
        `Score ${step.toLocaleString("en-US")} points in one run.`,
        `You scored ${step.toLocaleString("en-US")} points.`,
      ),
    ),
    ...metres.map((step) =>
      rung(
        "metres",
        step,
        `${step.toLocaleString("en-US")} metres`,
        `Roll ${step.toLocaleString("en-US")} metres in one run.`,
        `You rolled ${step.toLocaleString("en-US")} metres.`,
      ),
    ),
    rung(
      "height",
      120,
      "Spring",
      "Hold the button for a hop at least 40% as high as the highest.",
      "You made a good hop.",
    ),
    rung(
      "height",
      200,
      "Leap",
      "Hold the button for a hop at least 70% as high as the highest.",
      "You made a high leap.",
    ),
    rung(
      "height",
      270,
      "Full leap",
      "Hold the button all the way to the top of a hop.",
      "You hopped as high as a snowball can.",
    ),
    rung(
      "airtime",
      24,
      "Hang time",
      "Stay in the air for two fifths of a second in one hop.",
      "You hung in the air.",
    ),
    rung(
      "airtime",
      36,
      "Long jump",
      "Stay in the air for three fifths of a second in one hop.",
      "You made a long jump.",
    ),
    rung(
      "airtime",
      48,
      "Flight",
      "Stay in the air for four fifths of a second in one hop.",
      "You flew.",
    ),
    ...shards.map((step) =>
      rung(
        "shards",
        step,
        words(step, "shard", "shards"),
        `Collect ${words(step, "shard", "shards")} in one run.`,
        `You collected ${words(step, "shard", "shards")}.`,
      ),
    ),
    ...clears.map((step) =>
      rung(
        "clears",
        step,
        `${String(step)} obstacles`,
        `Clear ${String(step)} obstacles in one run.`,
        `You cleared ${String(step)} obstacles.`,
      ),
    ),
    ...kinds.flatMap(([prefix, one, many]) =>
      [10, 25].map((step) =>
        rung(
          prefix,
          step,
          words(step, one, many),
          `Clear ${words(step, one, many)} in one run.`,
          `You cleared ${words(step, one, many)}.`,
        ),
      ),
    ),
    ...streaks.map((step) =>
      rung(
        "streak",
        step,
        `${String(step)} in a row`,
        `Make ${String(step)} close calls in a row.`,
        `You cut ${String(step)} obstacles fine, one after another.`,
      ),
    ),
    rung(
      "close",
      25,
      "Living dangerously",
      "Make 25 close calls in one run.",
      "You cut twenty-five obstacles fine.",
    ),
  ],
  network: betaTarget.chainId,
  scene: "runner",
  schemaVersion: 1,
  summary:
    "Hop a snowball down an endless slope. Tap to hop, hold to go higher.",
  tags: ["endless", "reflex", "arcade"],
  title: "Snowball Dash",
  verification: {
    replay: {
      id: "snowball-dash",
      sha256:
        "937152d76b9bf722a53cad0641e231267029ea4812747e9a8fd05c004096c4eb",
      version: 2,
    },
  },
  version: "0.1.0",
});
