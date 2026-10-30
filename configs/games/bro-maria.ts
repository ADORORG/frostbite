import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// BRO MARIA: an original side-scrolling platformer. A hero runs and jumps across a level of icy ground, taking shards, stomping slimes,
// bumping crates and clearing pits, to the lantern at the far end. The working title is the owner's; it is close to a well-known game's, so it
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
    "Run and jump across an icy level: take shards, stomp slimes, bump crates, clear the pits and reach the lantern at the far end. Every milestone is checked by replaying your run.",
  id: "bro-maria",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-steps",
      "First steps",
      "Run 10 tiles into the level.",
      "You ran ten tiles in.",
    ),
    once(
      "tile-25",
      "Twenty-five tiles",
      "Get 25 tiles into the level.",
      "Twenty-five tiles in.",
    ),
    once(
      "quarter-way",
      "A quarter of the way",
      "Reach a quarter of the way through the level.",
      "A quarter of the level behind you.",
    ),
    once(
      "tile-75",
      "Seventy-five tiles",
      "Get 75 tiles into the level.",
      "Seventy-five tiles in.",
    ),
    once(
      "halfway",
      "Halfway lantern",
      "Light the lantern halfway through the level.",
      "You lit the halfway lantern.",
    ),
    once(
      "tile-125",
      "One twenty-five",
      "Get 125 tiles into the level.",
      "A hundred and twenty-five tiles in.",
    ),
    once(
      "three-quarters",
      "Three quarters",
      "Reach three quarters of the way through the level.",
      "Three quarters of the level behind you.",
    ),
    once(
      "tile-175",
      "One seventy-five",
      "Get 175 tiles into the level.",
      "A hundred and seventy-five tiles in.",
    ),
    once(
      "finish",
      "Level clear",
      "Reach the far lantern at the end of the level.",
      "You reached the end of the level.",
    ),
    once("first-coin", "First shard", "Take 1 shard.", "You took a shard."),
    once(
      "coins-5",
      "Five shards",
      "Take 5 shards in one run.",
      "Five shards in one run.",
    ),
    once(
      "coins-10",
      "Ten shards",
      "Take 10 shards in one run.",
      "Ten shards in one run.",
    ),
    once(
      "coins-25",
      "Twenty-five shards",
      "Take 25 shards in one run.",
      "Twenty-five shards in one run.",
    ),
    once(
      "coins-40",
      "Forty shards",
      "Take 40 shards in one run.",
      "Forty shards in one run.",
    ),
    once(
      "coins-50",
      "Fifty shards",
      "Take 50 shards in one run.",
      "Fifty shards in one run.",
    ),
    once(
      "coins-65",
      "Sixty-five shards",
      "Take 65 shards in one run.",
      "Sixty-five shards in one run.",
    ),
    once(
      "first-stomp",
      "First stomp",
      "Land on a slime.",
      "You stomped a slime.",
    ),
    once(
      "stomps-3",
      "Three stomps",
      "Stomp 3 slimes in one run.",
      "Three slimes stomped in one run.",
    ),
    once(
      "stomps-5",
      "Five stomps",
      "Stomp 5 slimes in one run.",
      "Five slimes stomped in one run.",
    ),
    once(
      "stomps-8",
      "Eight stomps",
      "Stomp 8 slimes in one run.",
      "Eight slimes stomped in one run.",
    ),
    once(
      "stomps-10",
      "Ten stomps",
      "Stomp 10 slimes in one run.",
      "Ten slimes stomped in one run.",
    ),
    once(
      "exterminator",
      "Exterminator",
      "Stomp every slime in the level.",
      "Not a slime left.",
    ),
    once(
      "combo-2",
      "Double stomp",
      "Stomp 2 slimes in a row without touching the ground.",
      "Two stomps in one bounce.",
    ),
    once(
      "combo-3",
      "Triple stomp",
      "Stomp 3 slimes in a row without touching the ground.",
      "Three stomps in one bounce.",
    ),
    once(
      "first-crate",
      "First crate",
      "Bump a crate from below.",
      "You bumped a crate.",
    ),
    once(
      "crates-3",
      "Three crates",
      "Bump 3 crates in one run.",
      "Three crates bumped in one run.",
    ),
    once(
      "crates-5",
      "Five crates",
      "Bump 5 crates in one run.",
      "Five crates bumped in one run.",
    ),
    once(
      "crates-8",
      "Eight crates",
      "Bump 8 crates in one run.",
      "Eight crates bumped in one run.",
    ),
    once(
      "untouched",
      "Untouched",
      "Finish the level without being hit or falling.",
      "A clean run: no hits, no falls.",
    ),
    once(
      "pit-proof",
      "Pit-proof",
      "Finish the level without falling into a pit.",
      "Not one fall.",
    ),
    once(
      "second-wind",
      "Second wind",
      "Finish the level after being hit or falling at least once.",
      "You came back and finished.",
    ),
    once(
      "last-life",
      "Last life",
      "Finish the level with one life left.",
      "Made it with your last life.",
    ),
    once(
      "speed-60",
      "One minute",
      "Finish the level in 60 seconds or less.",
      "Across the level in a minute.",
    ),
    once(
      "speedrun",
      "Speedrun",
      "Finish the level in 45 seconds or less.",
      "Across the level in forty-five seconds.",
    ),
    once(
      "lightning",
      "Lightning",
      "Finish the level in 42.5 seconds or less.",
      "Barely a pause on the way across.",
    ),
    once(
      "pacifist",
      "Pacifist",
      "Finish the level without stomping a slime.",
      "Not one slime stomped.",
    ),
    once(
      "collector",
      "Collector",
      "Finish the level with every shard.",
      "Every shard in the level.",
    ),
    once(
      "all-rounder",
      "All-rounder",
      "Finish the level with 25 shards, 5 stomps and 3 crates.",
      "A little of everything, and the end.",
    ),
    once(
      "tasting-menu",
      "Tasting menu",
      "Take 10 shards, stomp a slime and bump a crate in one run.",
      "A bit of everything.",
    ),
    once(
      "clean-start",
      "Clean start",
      "Reach 100 tiles without being hit or falling.",
      "A hundred tiles, no mistakes.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  scene: "hopper",
  schemaVersion: 1,
  summary: "Run, jump and stomp across an icy level to the far lantern.",
  title: "Bro Maria",
  verification: {
    replay: {
      id: "bro-maria",
      sha256:
        "cd2932899f957a9dfdd5b15321e2fa3381b5b3d5dbc555e451086ee2a42246bd",
      version: 1,
    },
  },
  version: "0.1.0",
});
