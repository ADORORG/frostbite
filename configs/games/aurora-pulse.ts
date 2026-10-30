import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// AURORA PULSE: a rhythm game. Notes fall down four lanes toward a line, and the player taps each lane as its note meets the line (D F J K, the
// arrow keys, or a quarter of the screen). A tap is judged perfect, great or good by how many ticks off it is, or is a stray; a note not tapped is a
// miss. Hits feed the light of the aurora and build a combo that multiplies the score; misses and strays drain the light, and the run ends when it
// is gone or the track (about ten minutes) is played out. The chart is made from the run's seed and gets denser stage by stage. Every milestone is
// decided by the rules alone (`games/aurora-pulse/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules as a
// verifier, the platform replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run followed the
// rules, not that a person played it. The digest pins the built file: a change to the rules is a change here, and a test fails until it is.
// Changing a goal changes the rules (and so the digest below) and is a new game version.
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

// The ladders. Their ids are the ones in `games/aurora-pulse/src/rules/milestones.ts`, which holds the numbers: a test fails if the two
// lists of ids differ. Each rung is earned within one run.
const many = (count: number, one: string, more: string) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : more}`;
const rungs = (
  prefix: string,
  steps: readonly number[],
  words: (count: number) => readonly [string, string, string],
) =>
  steps.map((step) => {
    const [title, criteria, description] = words(step);
    return once(`${prefix}-${String(step)}`, title, criteria, description);
  });

export const auroraPulseGame = defineGame({
  capabilities: ["run:submit"],
  cover: {
    alt: "Four glowing lanes of green, cyan, pink and yellow notes falling toward a bright line under bands of aurora light on a dark violet sky.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Four lanes of notes fall toward a line: tap each as it arrives. Perfect taps feed the light of the aurora and build a combo that multiplies your score; misses and stray taps drain it. The track gets denser every stage, with chords and runs, until the light goes out or the ten minutes are played. Forty milestones, from your first hit to a perfect run of a hundred and a full set, are each checked by replaying your taps.",
  id: "aurora-pulse",
  launch: { mode: "embedded" },
  milestones: [
    once("first-hit", "First hit", "Hit one note.", "You hit your first note."),
    ...rungs(
      "score",
      [5_000, 15_000, 40_000, 100_000, 250_000, 600_000, 1_500_000],
      (n) => [
        `${n.toLocaleString("en-US")} points`,
        `Score ${n.toLocaleString("en-US")} points in one run.`,
        `You scored ${n.toLocaleString("en-US")} points.`,
      ],
    ),
    ...rungs("combo", [10, 25, 50, 100, 200, 400, 800], (n) => [
      `${String(n)} combo`,
      `Hit ${String(n)} notes in a row without a miss or a stray tap.`,
      `You kept a combo of ${String(n)}.`,
    ]),
    ...rungs("perfects", [25, 100, 300, 800], (n) => [
      many(n, "perfect", "perfects"),
      `Make ${many(n, "perfect hit", "perfect hits")} in one run.`,
      `You made ${many(n, "perfect hit", "perfect hits")}.`,
    ]),
    ...rungs("stage", [2, 4, 6, 9, 12, 16, 20], (n) => [
      `Stage ${String(n)}`,
      `Reach stage ${String(n)}.`,
      `You reached stage ${String(n)} with the light still on.`,
    ]),
    ...rungs("hits", [50, 200, 600, 1_500], (n) => [
      many(n, "hit", "hits"),
      `Hit ${many(n, "note", "notes")} in one run.`,
      `You hit ${many(n, "note", "notes")}.`,
    ]),
    ...rungs("clean", [3, 8, 20, 50], (n) => [
      many(n, "clean bar", "clean bars"),
      `Play ${many(n, "bar", "bars")} through without a miss or a stray tap, in one run.`,
      `You played ${many(n, "bar", "bars")} clean.`,
    ]),
    ...rungs("streak", [5, 15, 40, 100], (n) => [
      `${String(n)} perfects in a row`,
      `Make ${String(n)} perfect hits in a row.`,
      `You made ${String(n)} perfect hits running.`,
    ]),
    once(
      "full-light",
      "Full light",
      "Fill the light of the aurora.",
      "You filled the light of the aurora to the top.",
    ),
    once(
      "full-set",
      "Full set",
      "Play the whole track to its end with the light on.",
      "You played the whole track.",
    ),
  ],
  network: betaTarget.chainId,
  schemaVersion: 1,
  summary:
    "Tap four lanes of falling notes in time, and keep the light of the aurora burning.",
  title: "Aurora Pulse",
  verification: {
    replay: {
      id: "aurora-pulse",
      sha256:
        "64486f801025e6d92b3dcf6b8898f9f489360c6ea2894d5705d02a9fb3aef911",
      version: 1,
    },
  },
  version: "0.1.0",
});
