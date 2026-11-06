import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle screen.
export const guide: Guide = {
  lines: [
    "TAP, SPACE OR ENTER: CATCH THE MARKER",
    "IN THE BRIGHT ZONE. A MISS ENDS THE RUN",
  ],
  start: "ENTER TO START",
  title: "STARTER GAME",
};
