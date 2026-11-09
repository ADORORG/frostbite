import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// PEACEFUL SAVAGE: LIGHT THE TREE: a story game in a real-time 3D world, from the book A Spark in the Dark. One level, three subplots that
// interleave (find Sparky; find the six maridium threads; weave the jackets and face the giant sly snake), and a finale that needs all
// three. The player chooses who leads (Kai, Zora, Mama Heerah or Dr. Ali) and finds the others where they start; the house greys and
// colours by room as the story goes. Every milestone is decided by the rules alone (`src/rules/milestones.ts`) and replay-checked by the
// verifier; the digest pins the built file, so a change to the rules is a change here. Nobody is harmed: the sly snakes are ancestors
// with feelings nobody listened to, and they are healed. The title, summary, words and milestone list are a draft for the owner.
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

export const peacefulSavageGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "The Savage family on the lawn of their home at night, under a great braided tree of gold light, with the meadow glowing with fireflies.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Choose who leads the Savage family through one night in their futuristic home and the meadow outside: Kai, eleven, who can build anything; Zora, eight, who makes and mixes anything; Mama Heerah, who senses what is coming; or Dr. Ali, Daddy, who leads. The house has gone grey and the ancestor tree in the hall has nearly gone out; the third strand of its trunk pulses, fades and has lost its balance. Find the others where they are (Daddy in the office fog, Kai on the porch, Zora in the meadow, Mama at the tree) and sit with them. Each has a lesson to live: Zora plants a garden and tends it into bloom, Kai rebuilds his tower a step at a time with a breath in the middle, Mama learns to say what she needs, and Daddy learns it is safe to be soft and turns what was handed down in pain into joy. Sly snakes, ancestors with feelings nobody listened to, whisper tricks; answer them truly and they turn gold and drop the maridium threads. Believe too many tricks with your spark low and you go grey and join them, for now. Play the six hand-keys on the beat, take the Savage Breath, open Savage Vision, gather tiny plasma, clues and relics, practise until you master each key and the family huddle, weave the jackets, and answer the ancestors' call to the hill together. When the tree is lit the giant sly snake lets the ancestors go, and at home the tree's third strand lights fully: the ancestors fade in round it, the family turns to you for the big hug, dances out to the drums and onto a stage for a sixty-second show with a band of ancestors (move each of them about the stage in turn), holds hands as their jackets light gold, and lifts off one by one. Share cards are made at every turning point. Thirty-six milestones, each checked by replaying your run.",
  id: "peaceful-savage",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-touch",
      "A hand on the tree",
      "Touch the ancestor tree.",
      "The tree woke under your hand and gave you Savage Vision.",
    ),
    once(
      "savage-vision",
      "Savage Vision",
      "Open Savage Vision.",
      "You saw the threads, the clues and the sly snakes the eye alone misses.",
    ),
    once(
      "sparky",
      "Sparky",
      "Help the lamp that would not go out, three hand-keys on the beat.",
      "Three rings of gold, and Sparky grinned out of the light.",
    ),
    once(
      "first-breath",
      "The Savage Breath",
      "Breathe in for four counts and out for six.",
      "One whole breath, in and out, the carrier of every key.",
    ),
    once(
      "found-kai",
      "Kai",
      "Sit with Kai at his cracked crystal tower and answer him truly.",
      "Kai walks with the family again.",
    ),
    once(
      "found-zora",
      "Zora",
      "Split open Zora's silly cube and answer her truly.",
      "Zora came out of her cube to walk with you.",
    ),
    once(
      "found-heerah",
      "Mama Heerah",
      "Breathe with Mama by the tree and answer her truly.",
      "Mama rested, and the family held her up for once.",
    ),
    once(
      "found-ali",
      "Dr. Ali",
      "Sit with Daddy in the office fog, knock, breathe and answer him truly.",
      "Daddy opened his hands and came home to his family.",
    ),
    once(
      "first-healed",
      "A snake turns gold",
      "Answer a sly snake's whisper with the truth.",
      "A sly snake heard the truth, turned gold and let its thread fall.",
    ),
    once(
      "all-threads",
      "Six threads",
      "Pick up all six maridium threads.",
      "Every maridium thread is in the family's hands.",
    ),
    once(
      "clean-heart",
      "Not fooled once",
      "Heal all six sly snakes without believing a single trick.",
      "Six snakes healed, and not one trick believed.",
    ),
    once(
      "jackets",
      "The jackets",
      "Weave the maridium jackets with Mama at her loom.",
      "The family wears its jackets of light.",
    ),
    once(
      "the-drawer",
      "The locked drawer",
      "Knock on Daddy's locked drawer and let go of what is in it.",
      "What was put away is let go.",
    ),
    once(
      "the-deck",
      "The card deck",
      "Pick up the family card deck in the hall.",
      "A card for every feeling, in the family's hands.",
    ),
    once(
      "the-garden",
      "Zora's garden",
      "Plant all three beds in the meadow with Zora, then tend each one into bloom.",
      "Planted, tended and in bloom: the land is loved.",
    ),
    once(
      "the-tower",
      "Kai's tower",
      "Build Kai's crystal tower again on his workbench: base, frame, a breath, the spire.",
      "Built again a step at a time, with a breath in the middle.",
    ),
    once(
      "pancakes",
      "Pancakes",
      "Make pancakes in the kitchen.",
      "The kitchen warmed up with the smell of pancakes.",
    ),
    once(
      "lights-on",
      "Every lamp",
      "Switch on every lamp in the house and the porch.",
      "The whole house is lit, room by room.",
    ),
    once(
      "curious",
      "Curious hands",
      "Touch 12 different things in the house and the meadow.",
      "Twelve things touched, and a little colour back with each.",
    ),
    once(
      "very-curious",
      "Every corner",
      "Touch 30 different things in the house and the meadow.",
      "Thirty things touched: nothing in the house is a stranger now.",
    ),
    once(
      "perfect-six",
      "Six perfect keys",
      "Play all six hand-keys perfectly on the hill against the giant sly snake.",
      "Cup, Comb, Knot, Knock, Split and Let-Go, each right on the beat.",
    ),
    once(
      "plasma-50",
      "Fifty motes",
      "Gather 50 motes of tiny plasma in one run.",
      "Fifty motes of tiny plasma gathered.",
    ),
    once(
      "all-plasma",
      "All the plasma",
      "Gather every mote of tiny plasma in the house and the meadow.",
      "Every mote of tiny plasma is yours.",
    ),
    once(
      "first-relic",
      "A relic",
      "Take one of the inventors' relics.",
      "Something true to know, held in your hand.",
    ),
    once(
      "all-relics",
      "Every relic",
      "Take all six inventors' relics.",
      "Six inventors, six relics, all remembered.",
    ),
    once(
      "all-clues",
      "Every clue",
      "Take all six clues the house hides.",
      "Every clue the house had to give.",
    ),
    once(
      "mirror-force",
      "Mirror force",
      "Breathe and look into a mirror until you come back to yourself.",
      "Steady again, with a charge of mirror force.",
    ),
    once(
      "master-key",
      "A key mastered",
      "Master one hand-key by practising it on the beat.",
      "One hand-key mastered.",
    ),
    once(
      "master-all",
      "Six keys mastered",
      "Master all six hand-keys by practising them on the beat.",
      "Every hand-key mastered.",
    ),
    once(
      "huddle-master",
      "The family huddle",
      "Master the family huddle by practising it with your family.",
      "The family holds together, arms round each other.",
    ),
    once(
      "level-3",
      "Level 3",
      "Rise to level 3 at the ancestor tree.",
      "The tree gave you its light three times over.",
    ),
    once(
      "level-7",
      "Fully lit",
      "Rise to level 7, the top, at the ancestor tree.",
      "Fully empowered by the ancestor tree.",
    ),
    once(
      "light-as-kai",
      "Lit by Kai",
      "Light the ancestor tree with Kai leading.",
      "Kai led the family home.",
    ),
    once(
      "light-as-zora",
      "Lit by Zora",
      "Light the ancestor tree with Zora leading.",
      "Zora led the family home.",
    ),
    once(
      "light-as-heerah",
      "Lit by Mama",
      "Light the ancestor tree with Mama Heerah leading.",
      "Mama led the family home.",
    ),
    once(
      "light-as-ali",
      "Lit by Daddy",
      "Light the ancestor tree with Dr. Ali leading.",
      "Daddy led the family home.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary:
    "Choose who leads the Savage family, heal the sly snakes with the truth, and light the ancestor tree to bring the colour home.",
  tags: ["action", "rhythm"],
  title: "Peaceful Savage: Light the Tree",
  verification: {
    replay: {
      id: "peaceful-savage",
      sha256:
        "a4887ff3a2ae984000bf2ec18b6e221fb9b1fdc4345cb082f663a4c2ecbec100",
      version: 1,
    },
  },
  version: "0.1.0",
});
