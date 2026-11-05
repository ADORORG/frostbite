import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle screen.
export const guide: Guide = {
  lines: [
    "TAP, SPACE OR DOWN: DROP THE BLOCK",
    "WHAT HANGS OVER THE TOWER IS CUT OFF",
    "TWO PERFECT DROPS IN A ROW GROW IT BACK",
  ],
  start: "ENTER TO START",
  title: "TOWER STACKER",
};
