import type { Guide } from "@ador/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is shown over the board by the SDK.
export const guide: Guide = {
  lines: [
    "ARROWS, WASD OR SWIPE: SLIDE ALL THE TILES",
    "TWO TILES OF A KIND JOIN INTO THE NEXT",
    "A MOVE THAT CHANGES NOTHING IS NOT MADE",
  ],
  start: "ENTER TO START",
  title: "ICICLE DROP",
};
