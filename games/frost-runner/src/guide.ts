import type { Guide } from "@frostbite/game-sdk/guide";

// What the first screen says before the first run: the game, what the player does, and how to begin. It is drawn by the SDK over the idle screen.
export const guide: Guide = {
  lines: [
    "SPACE, UP OR TAP THE TOP: JUMP THE SPIKES",
    "DOWN, S OR TAP THE BOTTOM: SLIDE UNDER ICICLES",
    "TAKE SHARDS - THE FASTER YOU GO THE FARTHER YOU RUN",
  ],
  start: "ENTER TO START",
  title: "FROST RUNNER",
};
