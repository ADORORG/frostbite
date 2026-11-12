import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle
// screen. A phone is told the touch version.
export const guide: Guide = {
  lines: [
    "ARROWS MOVE AND TURN, SPACE DROPS",
    "C HOLDS. FILL ROWS BEFORE THE ICE REACHES THE TOP",
  ],
  start: "ENTER TO START",
  title: "PERMAFROST",
  touchLines: [
    "SLIDE A THUMB LEFT OR RIGHT TO MOVE",
    "TAP TO TURN. DROP AND HOLD ARE THE BUTTONS",
  ],
  touchStart: "TAP TO START",
};
