import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// SHARD MATCH: a board of eight by eight shards in five (then six) kinds. The player swaps two neighbouring shards to line up three or more of
// a kind; lines clear, what is left falls, new shards come in, and a line made by what falls is a chain that scores more at each step. Four in a
// line leaves a bomb, five a star, and a star or a chain buys more swaps; the run ends when no swap is left. Every milestone is decided by the
// rules alone (`games/shard-match/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules as a verifier, the
// platform replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run followed the rules, not
// that a person played it. The digest pins the built file: a change to the rules is a change here, and a test fails until it is. Changing a
// goal changes the rules (and so the digest below) and is a new game version.
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

// The ladders. Their ids are the ones in `games/shard-match/src/rules/milestones.ts`, which holds the numbers: a test fails if the two
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

export const shardMatchGame = defineGame({
  capabilities: ["run:submit"],
  cover: {
    alt: "A grid of glowing cyan, pink, yellow, green, orange and violet shards in different shapes on a dark violet board, with a bomb and a star among them.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Swap two neighbouring shards to line up three or more. Lines clear, shards fall, and a line made by the fall is a chain that scores more at every step. Four in a line makes a bomb, five a star, and a long chain buys more swaps; the run ends when you are out. Forty milestones, from your first swap to a seven-step chain and a three-hundred-thousand point run, are each checked by replaying your run.",
  id: "shard-match",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-swap",
      "First swap",
      "Make one swap.",
      "You made your first swap.",
    ),
    ...rungs(
      "score",
      [1_000, 2_500, 5_000, 10_000, 20_000, 40_000, 80_000, 300_000],
      (n) => [
        `${n.toLocaleString("en-US")} points`,
        `Score ${n.toLocaleString("en-US")} points in one run.`,
        `You scored ${n.toLocaleString("en-US")} points.`,
      ],
    ),
    ...rungs("level", [2, 4, 6, 9, 13, 18], (n) => [
      `Level ${String(n)}`,
      `Reach level ${String(n)} in one run.`,
      `You reached level ${String(n)}.`,
    ]),
    ...rungs("chain", [2, 3, 4, 5, 7], (n) => [
      `${String(n)}-step chain`,
      `Set off a chain of ${String(n)} steps with one swap.`,
      `One swap set off a chain of ${String(n)} steps.`,
    ]),
    ...rungs("line", [4, 5, 6], (n) => [
      `A line of ${String(n)}`,
      `Clear a line of ${String(n)} shards.`,
      `You cleared a line of ${String(n)}.`,
    ]),
    ...rungs("bombs", [1, 6, 20], (n) => [
      many(n, "bomb", "bombs"),
      `Make ${many(n, "bomb", "bombs")} in one run.`,
      `You made ${many(n, "bomb", "bombs")}.`,
    ]),
    ...rungs("stars", [1, 6], (n) => [
      many(n, "star", "stars"),
      `Make ${many(n, "star", "stars")} in one run.`,
      `You made ${many(n, "star", "stars")}.`,
    ]),
    ...rungs("blasts", [1, 12], (n) => [
      many(n, "blast", "blasts"),
      `Set off ${many(n, "bomb", "bombs")} in one run.`,
      `You set off ${many(n, "bomb", "bombs")}.`,
    ]),
    ...rungs("shards", [50, 200, 600, 1_500], (n) => [
      many(n, "shard", "shards"),
      `Clear ${many(n, "shard", "shards")} in one run.`,
      `You cleared ${many(n, "shard", "shards")}.`,
    ]),
    ...rungs("swap", [200, 500, 1_000, 3_000], (n) => [
      `A ${n.toLocaleString("en-US")} point swap`,
      `Score ${n.toLocaleString("en-US")} points with one swap.`,
      `One swap was worth ${n.toLocaleString("en-US")} points.`,
    ]),
    ...rungs("swaps", [40, 150], (n) => [
      `${many(n, "swap", "swaps")}`,
      `Make ${many(n, "swap", "swaps")} in one run.`,
      `You made ${many(n, "swap", "swaps")}.`,
    ]),
  ],
  network: betaTarget.chainId,
  schemaVersion: 1,
  summary:
    "Swap neighbouring shards to line up three or more, and chain the falls for more.",
  title: "Shard Match",
  verification: {
    replay: {
      id: "shard-match",
      sha256:
        "3fd2dcaa4c84f9cf0eacb282fece695dd0954cad93f195c984258449a4338f97",
      version: 1,
    },
  },
  version: "0.1.0",
});
