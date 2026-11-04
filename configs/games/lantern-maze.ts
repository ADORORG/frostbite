import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// LANTERN MAZE: a cellar that goes down thirty floors, and a lantern that burns oil with every step. On each floor the player finds the key
// (in a blind alley) and then the locked door, seeing only the cells the lantern lights. Flasks of oil lie off the way; coming down to a
// floor brings oil for it, but less and less as the floors go, and the light shortens. Every milestone is decided by the rules alone
// (`games/lantern-maze/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules as a verifier, the platform
// replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run followed the rules, not that a
// person played it. The digest pins the built file: a change to the rules is a change here, and a test fails until it is. Changing a goal
// changes the rules (and so the digest below) and is a new game version.
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

// The ladders. Their ids are the ones in `games/lantern-maze/src/rules/milestones.ts`, which holds the numbers: a test fails if the two
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

export const lanternMazeGame = defineGame({
  capabilities: ["run:submit"],
  cover: {
    alt: "A small yellow lantern lighting a few tiles of a dark violet maze, with a key, a flask of oil and a locked door in the glow.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Thirty floors of a dark cellar and one lantern. Every step burns oil. Find the key, find the door, and see only what the light touches: flasks of oil lie off the way, the light shortens as you go down, and the oil you are given for each floor gets thinner. Forty milestones, from your first step to escaping all thirty floors, are each checked by replaying your run.",
  id: "lantern-maze",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-step",
      "First step",
      "Take one step.",
      "You took your first step in the dark.",
    ),
    ...rungs("floors", [1, 3, 5, 8, 12, 16, 20, 25, 30], (n) => [
      n === 30 ? "Out of the cellar" : `Down ${many(n, "floor", "floors")}`,
      `Clear ${many(n, "floor", "floors")} in one run.`,
      n === 30
        ? "You escaped all thirty floors."
        : `You cleared ${many(n, "floor", "floors")}.`,
    ]),
    ...rungs("flasks", [5, 15, 30, 60, 100], (n) => [
      many(n, "flask", "flasks"),
      `Take ${many(n, "flask", "flasks")} of oil in one run.`,
      `You took ${many(n, "flask", "flasks")} of oil.`,
    ]),
    ...rungs("lean", [1, 3, 6, 10, 15], (n) => [
      `${many(n, "lean floor", "lean floors")}`,
      `Clear ${many(n, "floor", "floors")} in at most 130% of the shortest route, in one run.`,
      `You cleared ${many(n, "floor", "floors")} without wandering.`,
    ]),
    ...rungs("flawless", [1, 3], (n) => [
      n === 1 ? "Straight to it" : "A sixth sense",
      `Clear ${many(n, "floor", "floors")} by exactly the shortest route, in one run.`,
      `You went the shortest way, blind, on ${many(n, "floor", "floors")}.`,
    ]),
    ...rungs("sweep", [1, 3, 6], (n) => [
      `${many(n, "clean sweep", "clean sweeps")}`,
      `Clear ${many(n, "floor", "floors")} having taken every flask on them, in one run.`,
      `You left no oil behind on ${many(n, "floor", "floors")}.`,
    ]),
    ...rungs("streak", [2, 4, 6], (n) => [
      `${String(n)} lean floors in a row`,
      `Clear ${String(n)} floors in a row, each in at most 130% of the shortest route.`,
      `You went straight, ${String(n)} floors running.`,
    ]),
    ...rungs("oil", [200, 250, 300, 400], (n) => [
      `${String(n)} oil`,
      `Hold ${String(n)} oil at one time.`,
      `Your lantern held ${String(n)} oil at once.`,
    ]),
    ...rungs("steps", [300, 1_000], (n) => [
      `${many(n, "step", "steps")}`,
      `Take ${many(n, "step", "steps")} in one run.`,
      `You walked ${many(n, "step", "steps")} in the dark.`,
    ]),
    ...rungs("score", [1_500, 4_000, 8_000, 15_000, 30_000, 50_000], (n) => [
      `${n.toLocaleString("en-US")} points`,
      `Score ${n.toLocaleString("en-US")} points in one run.`,
      `You scored ${n.toLocaleString("en-US")} points.`,
    ]),
  ],
  network: betaTarget.chainId,
  schemaVersion: 1,
  summary:
    "Find the key and the door in a dark cellar, lit only by a lantern whose oil every step burns.",
  tags: ["puzzle", "strategy"],
  title: "Lantern Maze",
  verification: {
    replay: {
      id: "lantern-maze",
      sha256:
        "c1f66ba2f34f532dcffc22f3bf93aaf1ba4679d21b57d4bdf77be16fbae56564",
      version: 1,
    },
  },
  version: "0.1.0",
});
