import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, how to choose who leads, how to walk, run and act, and how to begin. The SDK
// draws it over the screen; the arrows (or a swipe) put it away to show the family to choose from.
export const guide: Guide = {
  lines: [
    "LEFT AND RIGHT: CHOOSE WHO LEADS",
    "ARROWS OR WASD: WALK. SHIFT: RUN",
    "E OR SPACE: ACT. Q: SAVAGE VISION",
    "1 TO 8: PRACTISE",
  ],
  start: "ENTER TO START",
  title: "PEACEFUL SAVAGE",
  touchLines: [
    "SWIPE: CHOOSE WHO LEADS",
    "DRAG TO WALK, FURTHER TO RUN",
    "TAP TO ACT. BUTTONS: VISION, PRACTISE",
  ],
  touchStart: "TAP TO START",
};
