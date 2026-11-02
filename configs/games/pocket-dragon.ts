import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// POCKET DRAGON: GLITCHY'S QUEST: an original, family-friendly adventure in three levels that change dimension as they go, played as one
// timed run (the whole quest) or a level at a time for practice: Egg Hills, a side-scrolling platformer with DeFu's fights; the Guild
// and the Castle, a small role-playing quest on a map from above (day, night and winter); and the Whispering Woods, a maze seen through
// Glitchy's eyes and then DeFu's woods and lair in 3D, where her egg rocket is defused or launched. Hearts carry from level to level on one
// clock, and the page keeps a Hall of Fame of won quests. Nobody is ever hurt. Every milestone is decided by the rules alone
// (`games/pocket-dragon/src/rules/*/milestones.ts`) and replay-checked: the levels and the whole quest are one verifier with a cabinet
// each, and the platform replays a run it issued a seed for, which shows the run followed the rules, not that a person played it. The
// digest pins the built file: a change to the rules is a change here. The title, summary and milestone list are a draft for the owner.
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
    "Help Glitchy the baby dragon stop DeFu's egg rocket in a quest across three dimensions, played as one run against the clock. In Egg Hills (a side view), run and jump through wind, rain and fog, catch eggs, breathe fire, and at the end of each stage beat DeFu's baby ghost dragons (and her egg rocket) to unseal the portal while dodging her red-eyed laser strikes. The last portal shifts Glitchy into a new dimension: the Guild and the Castle, a map seen from above, where you help four dragon friends join your guild and win turn-based cheer challenges with hotkeys for shows, quick cheers, evading and secret charms. Then the world turns into the third dimension: the Whispering Woods, a moonlit maze seen through Glitchy's eyes, then DeFu's woods and lair in full 3D, where you fly low over the pond or soar over the trees with your freed dragons behind you, slow the world with frost vision to see three possible futures, send Sparky the glowing atom into nooks too small for a dragon, free caged dragons, find the rocket keys, break her egg factory, dodge her laser and shockwave, and defuse her egg rocket before it leaves for space. Your hearts carry from level to level and the clock never stops: win fast, with hearts to spare, for a place in your Hall of Fame. Each level you clear opens to practise on its own. Every level hides secret charms and metaplasma to gather, and berries, mushrooms and pineapples for your backpack to use when you like: fire that reaches farther, a glitch blast that rolls through everything in its way, or growing big so the next bump only shrinks you. Forty milestones, each checked by replaying your run, up to the Masterful Pocket Dragon Charm. Win the quest to open the secret Sky Nursery: gather eggs, hatch baby dragons, dance and paint the sky, then share its cards. After every run, make a trading card of it, trophies and all, to share as a post or a story.",
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
      "Cheer up 4 of DeFu's security guards in one run.",
      "Four dizzy guards.",
    ),
    once(
      "hills-rocket-eggs",
      "Egg rescue",
      "Catch 10 eggs freed from DeFu's egg rocket.",
      "The eggs are free!",
    ),
    once(
      "woods-all-clues",
      "Three clues",
      "Read all three clue stones in one run of the Whispering Woods.",
      "Three clues, one open gate.",
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
      "Out of the maze",
      "Leave the Whispering Woods' maze through the moon gate.",
      "The trees open up.",
    ),
    once(
      "woods-swift",
      "Swift wings",
      "Get out of the Whispering Woods' maze within 3 minutes of starting.",
      "Out in under three minutes.",
    ),
    once(
      "woods-launcher",
      "Launcher built",
      "Find all 4 parts of the egg launcher in the Whispering Woods.",
      "Ready to launch.",
    ),
    once(
      "woods-allies",
      "Cages open",
      "Free all 3 dragons from DeFu's cages in the Whispering Woods.",
      "Three more friends.",
    ),
    once(
      "woods-factory",
      "Factory down",
      "Break all 3 valves of DeFu's egg factory in her lair.",
      "No more shadow dragons.",
    ),
    once(
      "woods-defused",
      "Rocket defused",
      "Fit the three rocket keys into DeFu's egg rocket before it launches.",
      "Peace in the woods.",
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
      "guild-gear",
      "Fully geared",
      "Find the swift boots, the cheer cape and the ember helm in the castle's houses.",
      "Ready for anything.",
    ),
    once(
      "guild-eggs",
      "Night watch",
      "Save all 8 eggs from DeFu's guards on the night of the Guild and the Castle.",
      "Every egg is safe.",
    ),
    once(
      "guild-level-5",
      "Seasoned guild",
      "Raise your guild to level 5 in one run.",
      "A guild to be reckoned with.",
    ),
    once(
      "guild-castle",
      "Castle stormed",
      "Storm the castle and take the Legendary Golden Egg from the throne.",
      "The Legendary Golden Egg is yours.",
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
    once(
      "guild-charm",
      "Charmed",
      "Use a secret charm in a cheer challenge.",
      "A charm well used.",
    ),
    once(
      "quest-clear",
      "The whole quest",
      "Win the whole quest in one run: Egg Hills, the Guild and the Castle, and the Whispering Woods.",
      "Three dimensions, one run, the dragons saved.",
    ),
    once(
      "quest-all-hearts",
      "Not a scratch",
      "Win the whole quest without losing a heart.",
      "Every heart you started with, still beating.",
    ),
    once(
      "quest-one-heart",
      "By a whisker",
      "Win the whole quest with exactly one heart left.",
      "One heart left, and it was enough.",
    ),
    once(
      "quest-swift",
      "Speedrunner",
      "Win the whole quest in ten minutes or less.",
      "Faster than a rocket countdown.",
    ),
    once(
      "quest-all-eggs",
      "Every egg",
      "Win the whole quest with Egg Hills' 3 golden eggs, all 8 eggs of the castle's night saved, and every egg in the woods' maze.",
      "Not one egg left behind.",
    ),
    once(
      "quest-all-secrets",
      "Secret keeper",
      "Win the whole quest after visiting all 6 of Egg Hills' secret areas.",
      "Every tunnel and every cloud.",
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
      "Find a secret charm in any level.",
      "A secret, found.",
    ),
    once(
      "metaplasma-300",
      "Metaplasma",
      "Gather 300 metaplasma in one run of any level.",
      "A glowing armful.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  scene: "hopper",
  schemaVersion: 1,
  summary:
    "A baby dragon's quest across three dimensions: a boss-battle platformer, a guild of dragons who storm a castle, and a 3D race to defuse DeFu's egg rocket.",
  title: "Pocket Dragon: Glitchy's Quest",
  verification: {
    replay: {
      id: "pocket-dragon",
      sha256:
        "36c53bb0bc9ba10dc6b2348b291abdcab0321b78838d6a9ef65649f3d528e32a",
      version: 1,
    },
  },
  version: "0.1.0",
});
