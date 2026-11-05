import type { Guide } from "@ador/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle screen.
export const guide: Guide = {
  lines: [
    "ARROWS OR A D: RUN   SPACE OR UP: JUMP",
    "LAND ON SLIMES, BUMP CRATES, GRAB COINS",
    "CLEAR SIX STAGES, EACH HARDER - LANTERNS KEEP YOUR PLACE",
  ],
  start: "ENTER TO START",
  title: "BRO MARIA",
  touchLines: [
    "DRAG ON THE LEFT: RUN   HOLD THE RIGHT: JUMP",
    "LAND ON SLIMES, BUMP CRATES, GRAB COINS",
    "CLEAR SIX STAGES, EACH HARDER - LANTERNS KEEP YOUR PLACE",
  ],
};
