import {
  groundRow,
  maxTicks,
  playerHeight,
  startLives,
  tile,
} from "./constants.ts";
import { generateLevel } from "./level.ts";
import type { Hero, State } from "./types.ts";

// The hero stands two tiles in, on the ground, at rest.
export const startHero = (): Hero => ({
  buffer: 0,
  coyote: 0,
  grounded: true,
  vx: 0,
  vy: 0,
  x: 2 * tile,
  y: groundRow * tile - playerHeight,
});

// What of a stage is new when it begins: its level, its shards, crates and slimes untouched, the hero at the start, no lantern passed.
export function freshStage(seed: number, stage: number) {
  const level = generateLevel(seed, stage);
  return {
    checkpoint: false,
    coinsTaken: level.coins.map(() => false),
    combo: 0,
    cratesUsed: level.crates.map(() => false),
    farthest: 2,
    hero: startHero(),
    level,
    slimes: level.patrols.map((patrol) => ({
      alive: true,
      dir: 1 as const,
      x: patrol.x,
    })),
  };
}

// A run starts on the first stage with nothing held.
export function startRun(seed: number): State {
  const first = freshStage(seed, 1);
  return {
    ...first,
    bestCombo: 0,
    cleanStages: 0,
    coinsBanked: 0,
    controls: { jump: false, left: false, right: false },
    crates: 0,
    deaths: 0,
    ended: false,
    fastest: maxTicks,
    finishTick: null,
    hits: 0,
    invulnerable: 0,
    lives: startLives,
    over: false,
    perfectStages: 0,
    seed,
    stage: 1,
    stageLosses: 0,
    stageStart: 0,
    stagesCleared: 0,
    stomps: 0,
    tick: 0,
  };
}
