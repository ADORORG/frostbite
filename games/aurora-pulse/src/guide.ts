import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle
// screen, at the pixels of the display, so it stays sharp when the small screen is scaled up.
export const guide: Guide = {
  lines: [
    "TAP EACH NOTE AS IT MEETS THE LINE",
    "KEYS D F J K, ARROWS, OR TAP A LANE",
  ],
  start: "ENTER TO START",
  title: "AURORA PULSE",
};
