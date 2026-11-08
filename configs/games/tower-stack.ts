import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// TOWER STACKER: a block slides to and fro over a tower of ice and the player drops it; whatever hangs over is cut off, so the tower narrows
// unless every drop is clean. Every milestone is decided by the rules alone (`games/tower-stack/src/rules/milestones.ts`), so each can be
// replay-checked: the game publishes its rules as a verifier, the platform replays a run it issued a seed for, and the milestone is then
// held as replay-verified. That shows the run followed the rules, not that a person played it. The digest pins the built file: a change to
// the rules is a change here, and a test fails until it is. The milestone list is a draft for the owner to approve.
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

export const towerStackGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "A tall tower of glowing ice blocks in every colour under the northern lights, with one more block sliding in to be dropped.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Tap to drop the sliding block onto the tower. What hangs over is cut off, so the tower narrows with every miss. Land three in a row perfectly and it grows back. The block gets faster the higher you go. Every milestone is checked by replaying your run.",
  id: "tower-stack",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-block",
      "First block",
      "Stack 1 block.",
      "You stacked a block.",
    ),
    once(
      "ten-high",
      "Ten high",
      "Stack 10 blocks.",
      "A tower ten blocks high.",
    ),
    once(
      "quarter-hundred",
      "Twenty-five high",
      "Stack 25 blocks.",
      "A tower twenty-five blocks high.",
    ),
    once("fifty-high", "Fifty high", "Stack 50 blocks.", "Fifty blocks high."),
    once("century", "Century", "Stack 100 blocks.", "A hundred blocks high."),
    once("skyline", "Skyline", "Stack 200 blocks.", "Two hundred blocks high."),
    once(
      "first-perfect",
      "First perfect",
      "Land one block perfectly.",
      "You landed a block with nothing cut off.",
    ),
    once(
      "perfect-ten",
      "Ten perfect",
      "Land 10 blocks perfectly in one run.",
      "Ten clean landings in one run.",
    ),
    once(
      "perfect-fifty",
      "Fifty perfect",
      "Land 50 blocks perfectly in one run.",
      "Fifty clean landings in one run.",
    ),
    once(
      "triple",
      "Triple",
      "Land 3 blocks perfectly in a row.",
      "Three clean landings in a row.",
    ),
    once(
      "five-streak",
      "Five in a row",
      "Land 5 blocks perfectly in a row.",
      "Five clean landings in a row.",
    ),
    once(
      "ten-streak",
      "Ten in a row",
      "Land 10 blocks perfectly in a row.",
      "Ten clean landings in a row.",
    ),
    once(
      "twenty-streak",
      "Twenty in a row",
      "Land 20 blocks perfectly in a row.",
      "Twenty clean landings in a row.",
    ),
    once(
      "double-five",
      "Double five",
      "Land 5 perfectly in a row, miss one, then land 5 perfectly in a row again.",
      "Two separate streaks of five.",
    ),
    once(
      "regrown",
      "Regrown",
      "Win width back with a streak of perfect landings.",
      "You made the block wider again.",
    ),
    once(
      "needle",
      "Needle",
      "Reach 15 blocks high with a block 4 wide or narrower.",
      "A needle of a tower, fifteen high.",
    ),
    once(
      "wide-load",
      "Wide load",
      "Reach 30 blocks high with a block at least 30 wide.",
      "Thirty high and still broad.",
    ),
    once(
      "tidy-tower",
      "Tidy tower",
      "Reach 20 blocks high with at least 15 perfect landings.",
      "Twenty high, and mostly clean.",
    ),
    once(
      "by-a-hair",
      "By a hair",
      "Land a block that overlaps the tower by a single unit.",
      "You caught the tower by a hair.",
    ),
    once(
      "marathon",
      "Marathon",
      "Stack a block after three minutes of play.",
      "Still stacking after three minutes.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  scene: "builder",
  schemaVersion: 1,
  summary:
    "Drop the sliding block on the tower and build it as high as you can.",
  tags: ["reflex", "arcade"],
  title: "Tower Stacker",
  verification: {
    replay: {
      id: "tower-stack",
      sha256:
        "b81e60caeb09c3143c7e4e2c6cf55332fdfce27487d8b6408b4cd38e251740a8",
      version: 1,
    },
  },
  version: "0.1.0",
});
