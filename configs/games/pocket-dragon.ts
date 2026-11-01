import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// POCKET DRAGON: GLITCHY'S QUEST: an original, family-friendly adventure in three chapters, each its own run and each harder than the last.
// Egg Hills is a side-scrolling platformer (catch eggs, find the fire berry, breathe fire); the Whispering Woods is a maze seen through
// Glitchy's eyes (clue stones, lanterns, chests); the Guild and the Castle is a small role-playing quest (help four dragon friends join a
// guild, use their powers, cheer up grumble guards with shows). Clearing a chapter opens the next; nobody is ever hurt, a guard is cheered
// up and a tired guild takes a nap. Egg Hills ends each stage in a boss fight with Madame Vex (her ghost dragons, guards and egg rocket),
// the woods add an egg launcher and a launch round, the castle's challenges are turn-based with hotkeys, and every chapter has secret
// charms and metaplasma (banked by the page to be turned into items later). Between runs the page makes a card of the last run (or the
// quest so far) to share; it is a picture only, and decides nothing. Every milestone is decided by the rules alone
// (`games/pocket-dragon/src/rules/*/milestones.ts`), so each can be replay-checked: the three chapters are published as one verifier, the
// platform replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run followed the rules,
// not that a person played it. The digest pins the built file: a change to the rules is a change here, and a test fails until it is. The
// title, summary and milestone list are a draft for the owner to approve.
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

export const pocketDragonGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "Glitchy, a mint-green baby dragon, leaps for a golden egg over green hills, with a moonlit forest and a castle flying a banner behind.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Help Glitchy the baby dragon through a quest in three chapters, each harder than the last. In Egg Hills, run and jump through wind, rain and fog, catch eggs, breathe fire, and at the end of each stage beat Madame Vex's baby ghost dragons (and her egg rocket) to unseal the portal while dodging her red-eyed laser strikes. In the Whispering Woods, walk a moonlit maze through Glitchy's eyes: read three clue stones, find the parts of an egg launcher, then launch eggs at targets for bonus points. In the Guild and the Castle, help four dragon friends join your guild, then win turn-based cheer challenges with hotkeys for shows, quick cheers, evading and secret charms. Every chapter hides secret charms and metaplasma to gather. Clearing a chapter opens the next. Thirty-nine milestones, each checked by replaying your run, up to the Masterful Pocket Dragon Charm. After every run, make a trading card of it, trophies and all, to share as a post or a story.",
  id: "pocket-dragon",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-egg",
      "First egg",
      "Catch an egg in Egg Hills.",
      "Your very first egg.",
    ),
    once(
      "eggs-25",
      "Egg basket",
      "Catch 25 eggs in one run of Egg Hills.",
      "Twenty-five eggs.",
    ),
    once(
      "eggs-60",
      "Egg mountain",
      "Catch 60 eggs in one run of Egg Hills.",
      "Sixty eggs!",
    ),
    once(
      "golden-egg",
      "Golden egg",
      "Catch a golden egg in Egg Hills.",
      "A shiny golden egg.",
    ),
    once(
      "golden-eggs-3",
      "Golden trio",
      "Catch 3 golden eggs in one run of Egg Hills.",
      "Every golden egg in the hills.",
    ),
    once(
      "fire-breath",
      "First flame",
      "Eat the fire berry and breathe fire in Egg Hills.",
      "Glitchy found its fire.",
    ),
    once(
      "ice-melter",
      "Ice melter",
      "Melt 15 blocks of ice with fire in one run of Egg Hills.",
      "Fifteen blocks of ice, melted.",
    ),
    once(
      "cheer-5",
      "Cheer squad",
      "Cheer up 5 gloomlings in one run of Egg Hills.",
      "Five gloomlings smiling.",
    ),
    once(
      "hills-stage-2",
      "Over the first hill",
      "Clear the first stage of Egg Hills.",
      "The first stage is behind you.",
    ),
    once(
      "hills-clear",
      "Egg Hills cleared",
      "Clear all three stages of Egg Hills.",
      "Chapter one is complete.",
    ),
    once(
      "hills-no-bumps",
      "Not a bump",
      "Clear all three stages of Egg Hills without losing a heart.",
      "Not a single bump.",
    ),
    once(
      "hills-guards",
      "Guards go home",
      "Cheer up 4 of Madame Vex's security guards in one run.",
      "Four dizzy guards.",
    ),
    once(
      "hills-rocket-eggs",
      "Egg rescue",
      "Catch 10 eggs freed from Madame Vex's egg rocket.",
      "The eggs are free!",
    ),
    once(
      "woods-first-clue",
      "First clue",
      "Read a clue stone in the Whispering Woods.",
      "The stones are talking.",
    ),
    once(
      "woods-all-clues",
      "Three clues",
      "Read all three clue stones in one run of the Whispering Woods.",
      "Three clues, one open gate.",
    ),
    once(
      "woods-first-chest",
      "Treasure!",
      "Open a treasure chest in the Whispering Woods.",
      "Your first chest.",
    ),
    once(
      "woods-chests-5",
      "Treasure hunter",
      "Open all 5 treasure chests in one run of the Whispering Woods.",
      "Five chests found.",
    ),
    once(
      "woods-lanterns",
      "Lantern lighter",
      "Light all 3 lanterns with fire in one run of the Whispering Woods.",
      "The woods are glowing.",
    ),
    once(
      "woods-frozen-chest",
      "Moonlit treasure",
      "Melt the frozen door and open the moon chest in the Whispering Woods.",
      "The moon chest is yours.",
    ),
    once(
      "woods-escape",
      "Out of the woods",
      "Leave the Whispering Woods through the open gate.",
      "Chapter two is complete.",
    ),
    once(
      "woods-swift",
      "Swift wings",
      "Leave the Whispering Woods within 3 minutes of starting.",
      "Out in under three minutes.",
    ),
    once(
      "woods-everything",
      "Nothing left behind",
      "Leave the Whispering Woods after opening all 5 chests and the moon chest.",
      "Every treasure in the woods.",
    ),
    once(
      "woods-launcher",
      "Launcher built",
      "Find all 4 parts of the egg launcher in the Whispering Woods.",
      "Ready to launch.",
    ),
    once(
      "woods-launch-1000",
      "Egg-cellent aim",
      "Score 1,000 bonus points launching eggs at the targets.",
      "Bullseye after bullseye.",
    ),
    once(
      "guild-first-friend",
      "A new friend",
      "Bring a dragon friend what it wants, so it joins your guild.",
      "Your guild begins.",
    ),
    once(
      "guild-full",
      "The whole guild",
      "Have all 4 dragon friends join your guild in one run.",
      "Bolt, Splash, Bloom and Spark.",
    ),
    once(
      "guild-river",
      "Across the ford",
      "Cross the river with your guild.",
      "Lily pads all the way.",
    ),
    once(
      "guild-escape",
      "Through the brambles",
      "Lead your guild through the brambles and out of the woods, in sight of the castle.",
      "The woods are behind you.",
    ),
    once(
      "guild-first-cheer",
      "A first smile",
      "Cheer up a grumble guard with a show.",
      "One guard is smiling.",
    ),
    once(
      "guild-guards",
      "All smiles",
      "Cheer up all 3 grumble guards in one run.",
      "Every guard is grinning.",
    ),
    once(
      "guild-castle",
      "Castle captured",
      "Cheer up the Grumble King and raise your banner on the castle.",
      "Chapter three is complete.",
    ),
    once(
      "guild-never-napped",
      "Wide awake",
      "Capture the castle without your guild ever taking a nap.",
      "No naps needed.",
    ),
    once(
      "guild-favourite",
      "Perfect pick",
      "Cheer up a guard or the king after choosing its favourite show first.",
      "You found a favourite show.",
    ),
    once(
      "guild-swift",
      "Quick quest",
      "Capture the castle within 4 minutes of starting.",
      "Captured in under four minutes.",
    ),
    once("guild-evade", "Dodged it", "Evade a keeper's grumble.", "Missed!"),
    once(
      "guild-charm",
      "Charmed",
      "Use a secret charm in a cheer challenge.",
      "A charm well used.",
    ),
    once(
      "masterful-charm",
      "Masterful Pocket Dragon Charm",
      "Capture the castle with all 4 friends and all 3 secret charms, never napping, picking every keeper's favourite show first.",
      "A masterful Pocket Dragon.",
    ),
    once(
      "secret-charm",
      "Secret charm",
      "Find a secret charm in any chapter.",
      "A secret, found.",
    ),
    once(
      "metaplasma-300",
      "Metaplasma",
      "Gather 300 metaplasma in one run of any chapter.",
      "A glowing armful.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  scene: "hopper",
  schemaVersion: 1,
  summary:
    "A baby dragon's quest in three chapters: a boss-battle platformer, a moonlit maze with an egg launcher, and a guild of dragons who capture the castle.",
  title: "Pocket Dragon: Glitchy's Quest",
  verification: {
    replay: {
      id: "pocket-dragon",
      sha256:
        "bf8d23455cb7a0d69dbcf2f2efdc0eeaa8ee7b17e910feaca7f6a8a6fbebeeb4",
      version: 1,
    },
  },
  version: "0.1.0",
});
