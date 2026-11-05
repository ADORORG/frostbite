import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle
// screen, at the pixels of the display, so it stays sharp when the small screen is scaled up.
export const guide: Guide = {
  lines: [
    "SWAP TWO SHARDS: LINE UP THREE OR MORE",
    "REACH EACH LEVEL'S GOAL IN THE SWAPS GIVEN",
    "BREAK ALL THE FROST ON THE ICE LEVELS",
    "4 MAKE A BOMB, 5 A STAR - CHAINS PAY MORE",
  ],
  start: "ENTER TO START",
  title: "SHARD MATCH",
  // A phone held upright has a narrow screen: the same words in shorter lines.
  touchLines: [
    "SWAP TWO SHARDS TO",
    "LINE UP THREE OR MORE",
    "BEAT EACH LEVEL'S GOAL",
    "IN THE SWAPS GIVEN",
    "BREAK THE FROST",
    "ON THE ICE LEVELS",
    "4 MAKE A BOMB, 5 A STAR",
  ],
};
