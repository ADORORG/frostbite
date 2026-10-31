import { groundRow, heroHeight, startHearts, tile } from "./constants.ts";
import { generateHills } from "./level.ts";
import type { Hero, HillsState } from "./types.ts";

// Glitchy stands two tiles in, on the ground, facing right.
export const startHero = (): Hero => ({
  buffer: 0,
  coyote: 0,
  facing: 1,
  grounded: true,
  vx: 0,
  vy: 0,
  x: 2 * tile,
  y: groundRow * tile - heroHeight,
});

// What is new when a stage begins: its level, its eggs and ice untouched, its gloomlings grumpy, Glitchy at the start.
export function freshStage(seed: number, stage: number) {
  const level = generateHills(seed, stage);
  return {
    berryTaken: false,
    checkpoint: false,
    eggsTaken: level.eggs.map(() => false),
    fireballs: [],
    glooms: level.patrols.map((patrol) => ({
      alive: true,
      cheered: -1,
      dir: 1 as const,
      x: patrol.x,
    })),
    goldenTaken: false,
    hero: startHero(),
    level,
    melted: level.ice.map(() => false),
  };
}

export function startHills(seed: number): HillsState {
  return {
    ...freshStage(seed, 1),
    breaths: 0,
    cheers: 0,
    controls: { fire: false, jump: false, left: false, right: false },
    eggsBanked: 0,
    ended: false,
    finishTick: null,
    fireCooldown: 0,
    goldens: 0,
    hasFire: false,
    hearts: startHearts,
    heartsLost: 0,
    invulnerable: 0,
    meltedCount: 0,
    over: false,
    seed,
    stage: 1,
    stageStart: 0,
    stagesCleared: 0,
    tick: 0,
  };
}
