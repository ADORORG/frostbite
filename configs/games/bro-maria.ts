import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// BRO MARIA: an original side-scrolling platformer. A hero runs and jumps across six stages of icy ground, each harder than the last, taking shards, stomping slimes,
// bumping crates and clearing pits, to the lantern at the end of each. The working title is the owner's; it is close to a well-known game's, so it
// may need another name before the game is listed publicly. Every milestone is decided by the rules alone
// (`games/bro-maria/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules as a verifier, the platform replays
// a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run followed the rules, not that a person
// played it. The digest pins the built file: a change to the rules is a change here, and a test fails until it is. The milestone list is a
// draft for the owner to approve.
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

export const broMariaGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "A hero in a red parka leaping over a pit between icy platforms, shards in the air and a green slime below, under snowy purple mountains.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Run and jump across six stages of icy ground, each harder: take shards, stomp slimes (faster every stage), bump crates, clear pits and urchins, and reach the lantern at the end of each. Forty milestones, from your first stomp to a flawless run of all six stages, are each checked by replaying your run.",
  id: "bro-maria",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-steps",
      "First steps",
      "Run 10 tiles into a stage.",
      "You ran ten tiles in.",
    ),
    once(
      "tile-100",
      "A hundred tiles",
      "Get 100 tiles into a stage.",
      "A hundred tiles in.",
    ),
    once(
      "halfway",
      "The lantern",
      "Light the lantern halfway through a stage.",
      "You lit a lantern.",
    ),
    once(
      "stage-2",
      "Stage 2",
      "Clear stage 1.",
      "You cleared the first stage.",
    ),
    once(
      "stage-3",
      "Stage 3",
      "Clear stage 2.",
      "You cleared the second stage.",
    ),
    once(
      "stage-4",
      "Stage 4",
      "Clear stage 3.",
      "You cleared the third stage.",
    ),
    once(
      "stage-5",
      "Stage 5",
      "Clear stage 4.",
      "You cleared the fourth stage.",
    ),
    once(
      "stage-6",
      "Stage 6",
      "Clear stage 5.",
      "You cleared the fifth stage.",
    ),
    once(
      "finish",
      "Out of the ice",
      "Clear all six stages.",
      "You cleared all six stages.",
    ),
    once("first-coin", "First shard", "Take a shard.", "You took a shard."),
    once("coins-10", "10 shards", "Take 10 shards in one run.", "Ten shards."),
    once(
      "coins-25",
      "25 shards",
      "Take 25 shards in one run.",
      "Twenty-five shards.",
    ),
    once(
      "coins-50",
      "50 shards",
      "Take 50 shards in one run.",
      "Fifty shards.",
    ),
    once(
      "coins-100",
      "100 shards",
      "Take 100 shards in one run.",
      "A hundred shards.",
    ),
    once(
      "coins-175",
      "175 shards",
      "Take 175 shards in one run.",
      "A hundred and seventy-five shards.",
    ),
    once(
      "coins-250",
      "250 shards",
      "Take 250 shards in one run.",
      "Two hundred and fifty shards.",
    ),
    once(
      "first-stomp",
      "First stomp",
      "Land on a slime.",
      "You stomped a slime.",
    ),
    once(
      "stomps-5",
      "5 stomps",
      "Stomp 5 slimes in one run.",
      "Five slimes stomped.",
    ),
    once(
      "stomps-10",
      "10 stomps",
      "Stomp 10 slimes in one run.",
      "Ten slimes stomped.",
    ),
    once(
      "stomps-20",
      "20 stomps",
      "Stomp 20 slimes in one run.",
      "Twenty slimes stomped.",
    ),
    once(
      "stomps-40",
      "40 stomps",
      "Stomp 40 slimes in one run.",
      "Forty slimes stomped.",
    ),
    once(
      "stomps-70",
      "70 stomps",
      "Stomp 70 slimes in one run.",
      "Seventy slimes stomped.",
    ),
    once(
      "stomps-100",
      "100 stomps",
      "Stomp 100 slimes in one run.",
      "A hundred slimes stomped.",
    ),
    once(
      "combo-2",
      "Double stomp",
      "Stomp two slimes without touching the ground.",
      "Two slimes in one bounce.",
    ),
    once(
      "combo-3",
      "Triple stomp",
      "Stomp three slimes without touching the ground.",
      "Three slimes in one bounce.",
    ),
    once(
      "first-crate",
      "First crate",
      "Bump a crate from below.",
      "You bumped a crate.",
    ),
    once("crates-5", "5 crates", "Bump 5 crates in one run.", "Five crates."),
    once(
      "crates-12",
      "12 crates",
      "Bump 12 crates in one run.",
      "Twelve crates.",
    ),
    once(
      "crates-24",
      "24 crates",
      "Bump 24 crates in one run.",
      "Twenty-four crates.",
    ),
    once(
      "clean-stage",
      "A clean stage",
      "Clear a stage without being hit or falling.",
      "A stage with nothing lost.",
    ),
    once(
      "clean-stages-3",
      "Three clean stages",
      "Clear 3 stages without being hit or falling.",
      "Three clean stages.",
    ),
    once(
      "flawless",
      "Flawless",
      "Clear all six stages, each without being hit or falling.",
      "Six clean stages.",
    ),
    once(
      "pit-proof",
      "Pit-proof",
      "Clear all six stages without falling into a pit.",
      "You never fell.",
    ),
    once(
      "last-life",
      "Last life",
      "Clear all six stages with one life left.",
      "You finished on your last life.",
    ),
    once(
      "five-lives",
      "Five lives",
      "Have five lives at once.",
      "A full set of lives.",
    ),
    once(
      "swift",
      "Swift",
      "Clear a stage in 50 seconds.",
      "A stage in fifty seconds.",
    ),
    once(
      "lightning",
      "Lightning",
      "Clear a stage in 42.5 seconds.",
      "Barely stopping.",
    ),
    once(
      "collector",
      "Collector",
      "Take every shard of a stage.",
      "Every shard of a stage.",
    ),
    once(
      "collector-3",
      "Hoarder",
      "Take every shard of 3 stages.",
      "Every shard of three stages.",
    ),
    once(
      "tasting-menu",
      "Tasting menu",
      "Take 10 shards, stomp a slime and bump a crate in one run.",
      "A little of everything.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  scene: "hopper",
  schemaVersion: 1,
  summary: "Run, jump and stomp across an icy level to the far lantern.",
  tags: ["platformer", "action"],
  title: "Bro Maria",
  verification: {
    replay: {
      id: "bro-maria",
      sha256:
        "b201ef464c81f96beea4605f3b391ecc1bf22e22475c9a3bc9c6135275db878d",
      version: 2,
    },
  },
  version: "0.1.0",
});
