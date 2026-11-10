import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// FROST RUN: a small 3D game over three rounds on the ice. The art is made in Blender and packed into the game's own script (the frame
// may load no files); the rules are whole numbers only and draw nothing. Every milestone is decided by the rules alone
// (`games/frost-run/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules as a verifier, the platform
// replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run followed the rules, not that
// a person played it. The digest pins the built file: a change to the rules is a change here, and a test fails until it is. The
// milestone titles, the summary and the description are a draft for the owner; each milestone has a drawing for the staff page in
// `games/frost-run/milestones/`.
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

export const frostRunGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "Volt, a neon ram of light, runs across the Aurora Crown at night: mint crystals, a frost egg and a key around it, snowballs rolling in between spires of ice, a green and violet aurora overhead.",
    image: "cover.webp",
    video: null,
  },
  description:
    "Gather mint crystals, frost eggs and keys across three rounds on the ice, sixty seconds each, while snowballs roll in faster every fifteen seconds. Choose one of five heroes, each with a power of their own: Volt the neon ram, Nib the baby dragon, Lumen the spirit miner, Hrimm the ice giant or Pip the snow creature. Round one teaches moving, hopping and ducking on the Floe; round two adds rolling, shooting and hovering over the islets of Shatter Sound; round three adds growing and frost vision on the Aurora Crown. Take nine in ten of every treasure across the run to win. A hit knocks you back and costs five seconds. Every milestone is checked by replaying your run.",
  id: "frost-run",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-crystal",
      "First spark",
      "Collect a crystal.",
      "You took your first mint crystal.",
    ),
    once(
      "first-egg",
      "Egg in hand",
      "Collect a frost egg.",
      "You picked up your first frost egg.",
    ),
    once(
      "first-key",
      "Key catch",
      "Collect a key.",
      "You caught your first key.",
    ),
    once(
      "floe-clear",
      "Floe swept",
      "Collect every crystal, egg and key on the Floe.",
      "Not one treasure left on the Floe.",
    ),
    once(
      "sound-clear",
      "Sound swept",
      "Collect every crystal, egg and key in Shatter Sound.",
      "Every islet of Shatter Sound, picked clean.",
    ),
    once(
      "crown-clear",
      "Crown swept",
      "Collect every crystal, egg and key on the Aurora Crown.",
      "The Aurora Crown, swept under the northern lights.",
    ),
    once(
      "perfect-haul",
      "Not a flake missed",
      "Collect every item in all three rounds of one run.",
      "Every crystal, egg and key of all three rounds in one run.",
    ),
    once(
      "untouched-floe",
      "Untouched",
      "Finish the Floe without being hit.",
      "Not one snowball touched you on the Floe.",
    ),
    once(
      "swift-floe",
      "Swift floe",
      "Sweep the Floe with 25 seconds or more left.",
      "The Floe swept clean with time to spare.",
    ),
    once(
      "hop-scotch",
      "Hop-scotch",
      "Hop over 10 snowballs in one run.",
      "Ten snowballs hopped in one run.",
    ),
    once(
      "heads-down",
      "Heads down",
      "Duck under 8 icicle darts in one run.",
      "Eight icicle darts went over your head.",
    ),
    once(
      "close-shave",
      "Close shave",
      "Let a snowball brush past without touching you.",
      "A snowball brushed past and never touched you.",
    ),
    once(
      "double-spark",
      "Double spark",
      "Collect two crystals within a second and a half.",
      "Two crystals in a second and a half.",
    ),
    once(
      "island-hopper",
      "Island hopper",
      "Set foot on all five islets of Shatter Sound.",
      "Your feet touched all five islets of Shatter Sound.",
    ),
    once(
      "crate-cracker",
      "Crate cracker",
      "Crack all five ice crates in Shatter Sound.",
      "Five ice crates cracked open.",
    ),
    once(
      "snow-crusher",
      "Snow crusher",
      "Smash 12 snowballs or darts by rolling, shooting or growing.",
      "Twelve snowballs and darts smashed in one run.",
    ),
    once(
      "wall-breaker",
      "Cage breaker",
      "Break all five ice cages on the Aurora Crown.",
      "Five ice cages broken on the Crown.",
    ),
    once(
      "frost-sight",
      "Frost sight",
      "Find all four ghost keys with frost vision.",
      "Four ghost keys found with frost vision.",
    ),
    once(
      "win-as-volt",
      "Volt wins",
      "Win a run as Volt.",
      "A Frost Run won by the neon ram.",
    ),
    once(
      "win-as-nib",
      "Nib wins",
      "Win a run as Nib.",
      "A Frost Run won by the baby dragon.",
    ),
    once(
      "win-as-lumen",
      "Lumen wins",
      "Win a run as Lumen.",
      "A Frost Run won by the spirit miner.",
    ),
    once(
      "win-as-hrimm",
      "Hrimm wins",
      "Win a run as Hrimm.",
      "A Frost Run won by the ice giant.",
    ),
    once(
      "win-as-pip",
      "Pip wins",
      "Win a run as Pip.",
      "A Frost Run won by the snow creature.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary:
    "Take crystals, eggs and keys across three rounds on the ice, dodging snowballs, as one of five heroes.",
  tags: ["action", "arcade"],
  title: "Frost Run",
  verification: {
    replay: {
      id: "frost-run",
      sha256:
        "46b573f6032d68ba162dc9196632581bc2c35c725ad16be6b68193bcdea6a735",
      version: 1,
    },
  },
  version: "0.1.0",
});
