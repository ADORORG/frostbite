import { startState, stepInt } from "@frostbite/game-sdk/seeded";

import {
  arenaX,
  eggSize,
  groundRow,
  heroWidth,
  levelTiles,
  pixel,
  tile,
} from "./constants.ts";
import type { Boss, FreedEgg, Ghost, Hero, Rocket, Strike } from "./types.ts";

// The boss fight at the end of each stage, harder each time. Stage one: one baby ghost dragon and slow laser strikes. Stage two: two
// ghost dragons, security guards sent down one after another, and quicker strikes on two spots. Stage three: two ghost dragons, the egg
// rocket, more guards and three spots at a time. A strike is warned: DeFu's eyes glow red and the spots are marked on the ground,
// then the lasers come down there. Nobody is hurt: a beaten ghost dragon turns to sparkles, a guard goes home dizzy, and the rocket
// bursts and lets its eggs go.
export const ghostWidth = 14 * pixel;
export const ghostHeight = 12 * pixel;
export const guardWidth = 10 * pixel;
export const guardHeight = 14 * pixel;
export const rocketWidth = 24 * pixel;
export const rocketHeight = 12 * pixel;
export const strikeHalf = 12 * pixel;
export const strikeTicks = 18;
const ghostHp = 3;
const rocketHp = 6;
const freedCount = 12;
const groundY = groundRow * tile;
const arenaEnd = levelTiles * tile;

// Each stage's fight, by stage (one to three): how many ghost dragons and how fast they fly, how many guards are sent down, how many
// ticks apart and how fast they walk, how many spots a strike marks, how many ticks apart strikes come and how long each is warned.
const fights = [
  {
    ghostSpeed: 7,
    ghosts: 1,
    guardEvery: 0,
    guardSpeed: 0,
    guards: 0,
    marks: 1,
    rocket: false,
    strikeEvery: 260,
    warning: 60,
  },
  {
    ghostSpeed: 9,
    ghosts: 2,
    guardEvery: 300,
    guardSpeed: 5,
    guards: 3,
    marks: 2,
    rocket: false,
    strikeEvery: 200,
    warning: 50,
  },
  {
    ghostSpeed: 11,
    ghosts: 2,
    guardEvery: 220,
    guardSpeed: 6,
    guards: 5,
    marks: 3,
    rocket: true,
    strikeEvery: 150,
    warning: 42,
  },
] as const;

export type Fight = (typeof fights)[number];

export const bossOf = (stage: number): Fight =>
  fights[Math.max(0, Math.min(2, stage - 1))] ?? fights[0];

// A wave that goes up and back down: 0 to period / 2 and back.
const wave = (tick: number, period: number): number => {
  const at = ((tick % period) + period) % period;
  return at < period / 2 ? at : period - at;
};

// A ghost dragon dips to half a tile over the ground and rises three tiles higher; the rocket hovers one to three tiles up.
export const ghostY = (ghost: Ghost, tick: number): number =>
  groundY -
  ghostHeight -
  tile / 2 -
  Math.floor((wave(tick + ghost.phase, 220) * 3 * tile) / 110);
export const rocketY = (tick: number): number =>
  groundY -
  rocketHeight -
  tile -
  Math.floor((wave(tick, 260) * 2 * tile) / 130);
export const guardY = groundY - guardHeight;

export function startBoss(seed: number, stage: number): Boss {
  let rng = startState(seed ^ Math.imul(stage, 0x2545_f491));
  const ghosts: Ghost[] = [];
  for (let at = 0; at < bossOf(stage).ghosts; at += 1) {
    const rolled = stepInt(rng, 220);
    rng = rolled.state;
    ghosts.push({
      dir: at % 2 === 0 ? -1 : 1,
      freed: -1,
      hp: ghostHp,
      hurt: 0,
      phase: rolled.value,
      x: arenaX + (6 + at * 4) * tile,
    });
  }
  return {
    beaten: -1,
    freed: [],
    ghosts,
    guards: [],
    launched: 0,
    rng,
    rocket: bossOf(stage).rocket
      ? { dir: 1, hp: rocketHp, hurt: 0, x: arenaX + 5 * tile }
      : null,
    started: -1,
    strike: null,
  };
}

// The lasers are coming down now (after the warning).
export const striking = (
  strike: Strike | null,
  tick: number,
  stage: number,
): boolean =>
  strike !== null &&
  tick >= strike.start + bossOf(stage).warning &&
  tick < strike.start + bossOf(stage).warning + strikeTicks;

const bounded = (
  x: number,
  low: number,
  high: number,
  dir: -1 | 1,
  speed: number,
) => {
  const next = x + dir * speed;
  if (next <= low) return { dir: 1 as const, x: low };
  if (next >= high) return { dir: -1 as const, x: high };
  return { dir, x: next };
};

export const freeEggs = (rocket: Rocket, tick: number): readonly FreedEgg[] =>
  Array.from({ length: freedCount }, (_, at) => ({
    caught: false,
    vx: (at * 2 - (freedCount - 1)) * 3,
    vy: -40 - (at % 3) * 8,
    x: rocket.x + rocketWidth / 2 - eggSize / 2,
    y: rocketY(tick),
  }));

const fall = (egg: FreedEgg): FreedEgg => {
  if (egg.caught || (egg.vy === 0 && egg.vx === 0)) return egg;
  const vy = Math.min(60, egg.vy + 3);
  const x = Math.max(arenaX, Math.min(arenaEnd - eggSize, egg.x + egg.vx));
  const y = egg.y + vy;
  return y + eggSize >= groundY
    ? { ...egg, vx: 0, vy: 0, x, y: groundY - eggSize }
    : { ...egg, vx: egg.vx, vy, x, y };
};

// One tick of the fight with nobody touching anything: it begins when Glitchy comes into the arena, then ghosts and the rocket fly,
// guards are sent down and walk toward Glitchy, strikes are marked and come down, and freed eggs fall.
export function moveBoss(
  boss: Boss,
  hero: Hero,
  stage: number,
  tick: number,
): Boss {
  if (boss.started < 0)
    return hero.x + heroWidth > arenaX ? { ...boss, started: tick } : boss;
  const rules = bossOf(stage);
  const freed = boss.freed.map(fall);
  if (boss.beaten >= 0) return { ...boss, freed };
  const since = tick - boss.started;
  const ghosts = boss.ghosts.map((ghost) =>
    ghost.hp <= 0
      ? ghost
      : {
          ...ghost,
          ...bounded(
            ghost.x,
            arenaX + 2 * tile,
            arenaX + 12 * tile - ghostWidth,
            ghost.dir,
            rules.ghostSpeed,
          ),
          hurt: Math.max(0, ghost.hurt - 1),
        },
  );
  const rocket =
    boss.rocket === null || boss.rocket.hp <= 0
      ? boss.rocket
      : {
          ...boss.rocket,
          ...bounded(
            boss.rocket.x,
            arenaX + 3 * tile,
            arenaX + 11 * tile - rocketWidth,
            boss.rocket.dir,
            5,
          ),
          hurt: Math.max(0, boss.rocket.hurt - 1),
        };
  const middle = hero.x + heroWidth / 2;
  const sendGuard =
    rules.guards > boss.launched &&
    (since === 30 || (since > 30 && since % rules.guardEvery === 30));
  const guards = [
    ...boss.guards.map((guard) => {
      const dir: -1 | 1 = middle < guard.x + guardWidth / 2 ? -1 : 1;
      return {
        dir,
        x: Math.max(
          arenaX,
          Math.min(arenaEnd - guardWidth, guard.x + dir * rules.guardSpeed),
        ),
      };
    }),
    ...(sendGuard ? [{ dir: -1 as const, x: (levelTiles - 5) * tile }] : []),
  ];
  const strikeDone =
    boss.strike !== null &&
    tick >= boss.strike.start + rules.warning + strikeTicks;
  const volley = since >= 120 && (since - 120) % rules.strikeEvery === 0;
  const spots = [0, 3 * tile, -3 * tile].slice(0, rules.marks);
  const strike: Strike | null = volley
    ? {
        marks: spots.map((by) =>
          Math.max(arenaX + tile, Math.min(arenaEnd - 2 * tile, middle + by)),
        ),
        start: tick,
      }
    : strikeDone
      ? null
      : boss.strike;
  return {
    ...boss,
    freed,
    ghosts,
    guards,
    launched: boss.launched + (sendGuard ? 1 : 0),
    rocket,
    strike,
  };
}
