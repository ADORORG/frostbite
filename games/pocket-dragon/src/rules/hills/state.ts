import { groundRow, heroHeight, startHearts, tile } from "./constants.ts";
import { freshPlasma } from "../plasma.ts";
import { startBoss } from "./boss.ts";
import { generateHills } from "./level.ts";
import type { Hero, HillsState } from "./types.ts";

// Glitchy stands two tiles in, on the ground, facing right.
export const startHero = (): Hero => ({
  buffer: 0,
  coyote: 0,
  facing: 1,
  grounded: true,
  sprung: false,
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
    boss: startBoss(seed, stage),
    charmTaken: false,
    checkpoint: false,
    eggsTaken: level.eggs.map(() => false),
    fireballs: [],
    forceTaken: false,
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
    plasma: freshPlasma(level.motes),
    skyFound: false,
    tunnelFound: false,
    wingsTaken: false,
  };
}

export function startHills(seed: number): HillsState {
  return {
    ...freshStage(seed, 1),
    breaths: 0,
    charms: 0,
    cheers: 0,
    controls: {
      down: false,
      fire: false,
      jump: false,
      left: false,
      right: false,
    },
    eggsBanked: 0,
    ended: false,
    feather: false,
    finishTick: null,
    fireCooldown: 0,
    forcefield: 0,
    freedCaught: 0,
    goldens: 0,
    guardsCheered: 0,
    hasFire: false,
    hearts: startHearts,
    heartsLost: 0,
    invulnerable: 0,
    magnet: false,
    meltedCount: 0,
    over: false,
    plasmaBanked: 0,
    secretsFound: 0,
    seed,
    shield: false,
    stage: 1,
    stageStart: 0,
    stagesCleared: 0,
    tick: 0,
    wings: 0,
  };
}
