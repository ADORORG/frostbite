import {
  bounce,
  bounceHeld,
  coinSize,
  hitKnock,
  invulnerableTicks,
  lifeStages,
  maxLives,
  playerHeight,
  playerWidth,
  rows,
  slimeHeight,
  slimeWidth,
  stages,
  stompDepth,
  tile,
  urchinHeight,
  urchinWidth,
} from "./constants.ts";
import { moveHero } from "./hero.ts";
import { freshStage, startHero } from "./state.ts";
import type { Hero, Slime, State } from "./types.ts";

const touching = (
  hero: Hero,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean =>
  hero.x < x + width &&
  hero.x + playerWidth > x &&
  hero.y < y + height &&
  hero.y + playerHeight > y;

const walk = (state: State): readonly Slime[] =>
  state.slimes.map((slime, at) => {
    const patrol = state.level.patrols[at];
    if (!slime.alive || patrol === undefined) return slime;
    const x = slime.x + slime.dir * state.level.slimeSpeed;
    if (x <= patrol.minX) return { ...slime, dir: 1, x: patrol.minX };
    if (x >= patrol.maxX) return { ...slime, dir: -1, x: patrol.maxX };
    return { ...slime, x };
  });

// The hero loses a life: it is put back at the last lantern it passed, or ends the run if it was the last.
function lose(state: State, hero: Hero, fell: boolean): State {
  const lives = state.lives - 1;
  const common = {
    ...state,
    combo: 0,
    deaths: state.deaths + (fell ? 1 : 0),
    hits: state.hits + (fell ? 0 : 1),
    invulnerable: invulnerableTicks,
    lives,
    over: lives <= 0,
  };
  if (!fell)
    return { ...common, hero: { ...hero, grounded: false, vy: -hitKnock } };
  const column = state.checkpoint ? state.level.checkpointX : 2 * tile;
  return { ...common, hero: { ...startHero(), x: column } };
}

// The stage the hero has just reached the goal of is counted (its time, its shards, whether it cost nothing), and, unless it was the last, the
// next begins: a new level, the hero back at the start, and a life won on some stages.
function cleared(state: State): State {
  const taken = state.coinsTaken.filter(Boolean).length;
  const took = state.tick - state.stageStart;
  const counted: State = {
    ...state,
    cleanStages:
      state.cleanStages +
      (state.hits + state.deaths === state.stageLosses ? 1 : 0),
    coinsBanked: state.coinsBanked + taken,
    fastest: Math.min(state.fastest, took),
    perfectStages:
      state.perfectStages + (taken === state.coinsTaken.length ? 1 : 0),
    stagesCleared: state.stagesCleared + 1,
  };
  if (state.stage >= stages) return { ...counted, finishTick: state.tick };
  const stage = state.stage + 1;
  return {
    ...counted,
    ...freshStage(state.seed, stage),
    invulnerable: invulnerableTicks,
    lives: lifeStages.some((won) => won === state.stage)
      ? Math.min(maxLives, state.lives + 1)
      : state.lives,
    stage,
    stageLosses: state.hits + state.deaths,
    stageStart: state.tick,
  };
}

// One tick of the world. The hero moves; then what it touched is settled: coins, crates it bumped, slimes it landed on or ran into, urchins,
// the lantern halfway, the goal, and the pit.
export function tickOnce(state: State): State {
  if (state.over || state.finishTick !== null)
    return { ...state, tick: state.tick + 1 };
  const { level } = state;
  const moved = moveHero(level, state.hero, state.controls, state.cratesUsed);
  const hero = moved.hero;
  const slimes = walk(state);
  const grounded = moved.landed;
  let next: State = {
    ...state,
    combo: grounded ? 0 : state.combo,
    hero,
    invulnerable: Math.max(0, state.invulnerable - 1),
    slimes,
    tick: state.tick + 1,
  };
  if (moved.bumped.length > 0) {
    const used = [...state.cratesUsed];
    for (const at of moved.bumped) used[at] = true;
    next = {
      ...next,
      crates: state.crates + moved.bumped.length,
      cratesUsed: used,
    };
  }
  const coinsTaken = state.coinsTaken.map((taken, at) => {
    const coin = level.coins[at];
    return (
      taken ||
      (coin !== undefined && touching(hero, coin.x, coin.y, coinSize, coinSize))
    );
  });
  if (coinsTaken.some((taken, at) => taken !== state.coinsTaken[at]))
    next = { ...next, coinsTaken };
  if (hero.y > rows * tile) return lose(next, hero, true);
  const bottom = state.hero.y + playerHeight;
  let hurt = false;
  slimes.forEach((slime, at) => {
    const patrol = level.patrols[at];
    if (!slime.alive || patrol === undefined) return;
    if (!touching(hero, slime.x, patrol.y, slimeWidth, slimeHeight)) return;
    if (moved.falling > 0 && bottom <= patrol.y + stompDepth) {
      const combo = next.combo + 1;
      const killed = [...next.slimes];
      killed[at] = { ...slime, alive: false };
      next = {
        ...next,
        bestCombo: Math.max(next.bestCombo, combo),
        combo,
        hero: {
          ...next.hero,
          grounded: false,
          vy: state.controls.jump ? -bounceHeld : -bounce,
        },
        slimes: killed,
        stomps: next.stomps + 1,
      };
    } else hurt = true;
  });
  for (const urchin of level.urchins)
    if (touching(hero, urchin.x, urchin.y, urchinWidth, urchinHeight))
      hurt = true;
  if (hurt && next.invulnerable === 0) next = lose(next, next.hero, false);
  const tileColumn = Math.floor(next.hero.x / tile);
  const here: State = {
    ...next,
    checkpoint: next.checkpoint || next.hero.x >= level.checkpointX,
    farthest: Math.max(next.farthest, tileColumn),
  };
  return here.hero.x + playerWidth >= level.goalX && !here.over
    ? cleared(here)
    : here;
}

// Plays the world on to `tick`: the same ticks the screen would have, with the controls as they were held.
export function advanceTo(state: State, tick: number): State {
  let current = state;
  while (current.tick < tick) current = tickOnce(current);
  return current;
}
