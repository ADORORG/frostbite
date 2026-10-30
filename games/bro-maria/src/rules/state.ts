import { groundRow, playerHeight, startLives, tile } from "./constants.ts";
import { generateLevel } from "./level.ts";
import type { State } from "./types.ts";

// The hero starts two tiles in, standing on the ground, with nothing held.
export function startRun(seed: number): State {
  const level = generateLevel(seed);
  return {
    bestCombo: 0,
    checkpoint: false,
    coinsTaken: level.coins.map(() => false),
    combo: 0,
    controls: { jump: false, left: false, right: false },
    crates: 0,
    cratesUsed: level.crates.map(() => false),
    deaths: 0,
    ended: false,
    farthest: 2,
    finishTick: null,
    hero: {
      buffer: 0,
      coyote: 0,
      grounded: true,
      vx: 0,
      vy: 0,
      x: 2 * tile,
      y: groundRow * tile - playerHeight,
    },
    hits: 0,
    invulnerable: 0,
    level,
    lives: startLives,
    over: false,
    slimes: level.patrols.map((patrol) => ({
      alive: true,
      dir: 1,
      x: patrol.x,
    })),
    stomps: 0,
    tick: 0,
  };
}
