import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle
// screen, at the pixels of the display, so it stays sharp when the small screen is scaled up.
export const guide: Guide = {
  lines: [
    "FIND THE KEY, REACH THE DOOR",
    "EVERY STEP BURNS OIL",
    "ARROWS OR WASD TO WALK",
  ],
  start: "ENTER TO LIGHT",
  title: "LANTERN MAZE",
  touchLines: [
    "FIND THE KEY, REACH THE DOOR",
    "EVERY STEP BURNS OIL",
    "TAP OR HOLD WHERE TO WALK",
  ],
};
