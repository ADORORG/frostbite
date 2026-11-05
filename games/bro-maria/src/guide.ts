import type { Guide } from "@ador/game-sdk/guide";

// The lines about the game, the same whatever the hands.
const aboutTheGame = [
  "LAND ON SLIMES, BUMP CRATES, GRAB COINS",
  "CLEAR SIX STAGES, EACH HARDER - LANTERNS KEEP YOUR PLACE",
] as const;

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle screen.
export const guide: Guide = {
  lines: ["ARROWS OR A D: RUN   SPACE OR UP: JUMP", ...aboutTheGame],
  start: "ENTER TO START",
  title: "BRO MARIA",
  touchLines: ["DRAG ON THE LEFT: RUN   HOLD THE RIGHT: JUMP", ...aboutTheGame],
};
