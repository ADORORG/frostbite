import {
  berrySize,
  bounce,
  bounceHeld,
  eggSize,
  gloomHeight,
  gloomWidth,
  heartStages,
  heroHeight,
  heroWidth,
  hitKnock,
  invulnerableTicks,
  maxHearts,
  rows,
  stages,
  stompDepth,
  thornHeight,
  thornWidth,
  tile,
} from "./constants.ts";
import { touching } from "./collide.ts";
import { fly } from "./fire.ts";
import { moveHero } from "./hero.ts";
import { freshStage, startHero } from "./state.ts";
import type { Gloom, Hero, HillsState, Spot } from "./types.ts";

const heroOn = (hero: Hero, spot: Spot, size: number): boolean =>
  touching(hero.x, hero.y, heroWidth, heroHeight, spot.x, spot.y, size, size);

const walk = (state: HillsState): readonly Gloom[] =>
  state.glooms.map((gloom, at) => {
    const patrol = state.level.patrols[at];
    if (!gloom.alive || patrol === undefined) return gloom;
    const x = gloom.x + gloom.dir * state.level.gloomSpeed;
    if (x <= patrol.minX) return { ...gloom, dir: 1, x: patrol.minX };
    if (x >= patrol.maxX) return { ...gloom, dir: -1, x: patrol.maxX };
    return { ...gloom, x };
  });

const cheer = (
  glooms: readonly Gloom[],
  at: number,
  tick: number,
): readonly Gloom[] =>
  glooms.map((gloom, index) =>
    index === at ? { ...gloom, alive: false, cheered: tick } : gloom,
  );

// A heart is lost: to a bump (Glitchy is knocked up and blinks a while) or a fall (back to the start, or the nest halfway once passed).
function lose(state: HillsState, fell: boolean): HillsState {
  const hearts = state.hearts - 1;
  const hurt = {
    ...state,
    fireballs: [],
    hearts,
    heartsLost: state.heartsLost + 1,
    invulnerable: invulnerableTicks,
    over: hearts <= 0,
  };
  if (!fell)
    return { ...hurt, hero: { ...state.hero, grounded: false, vy: -hitKnock } };
  const x = state.checkpoint ? state.level.checkpointX : 2 * tile;
  return { ...hurt, hero: { ...startHero(), x } };
}

// The portal at the end is reached: the stage is counted, and the next begins (with a heart for some), unless it was the last.
function cleared(state: HillsState): HillsState {
  const counted: HillsState = {
    ...state,
    eggsBanked: state.eggsBanked + state.eggsTaken.filter(Boolean).length,
    stagesCleared: state.stagesCleared + 1,
  };
  if (state.stage >= stages) return { ...counted, finishTick: state.tick };
  return {
    ...counted,
    ...freshStage(state.seed, state.stage + 1),
    hearts: heartStages.some((won) => won === state.stage)
      ? Math.min(maxHearts, state.hearts + 1)
      : state.hearts,
    invulnerable: invulnerableTicks,
    stage: state.stage + 1,
    stageStart: state.tick,
  };
}

// One tick of Egg Hills: Glitchy moves, the gloomlings walk, the fire flies; then what Glitchy touched is settled.
export function tickHills(state: HillsState): HillsState {
  if (state.over || state.finishTick !== null)
    return { ...state, tick: state.tick + 1 };
  const { level } = state;
  const tick = state.tick + 1;
  const moved = moveHero(level, state.melted, state.hero, state.controls);
  const hero = moved.hero;
  let glooms = walk(state);
  const flown = fly(state, glooms);
  for (const at of flown.cheered) glooms = cheer(glooms, at, tick);
  let next: HillsState = {
    ...state,
    cheers: state.cheers + flown.cheered.length,
    fireCooldown: Math.max(0, state.fireCooldown - 1),
    fireballs: flown.fireballs,
    glooms,
    hero,
    invulnerable: Math.max(0, state.invulnerable - 1),
    melted: flown.melted,
    meltedCount: state.meltedCount + flown.newlyMelted,
    tick,
  };
  const eggsTaken = state.eggsTaken.map((taken, at) => {
    const egg = level.eggs[at];
    return taken || (egg !== undefined && heroOn(hero, egg, eggSize));
  });
  if (eggsTaken.some((taken, at) => taken !== state.eggsTaken[at]))
    next = { ...next, eggsTaken };
  if (!next.goldenTaken && heroOn(hero, level.golden, eggSize))
    next = { ...next, goldenTaken: true, goldens: next.goldens + 1 };
  if (!next.berryTaken && heroOn(hero, level.berry, berrySize))
    next = { ...next, berryTaken: true, hasFire: true };
  if (hero.y > rows * tile) return lose(next, true);
  const bottom = state.hero.y + heroHeight;
  let hurt = false;
  next.glooms.forEach((gloom, at) => {
    const patrol = level.patrols[at];
    if (!gloom.alive || patrol === undefined) return;
    if (
      !touching(
        hero.x,
        hero.y,
        heroWidth,
        heroHeight,
        gloom.x,
        patrol.y,
        gloomWidth,
        gloomHeight,
      )
    )
      return;
    if (moved.falling > 0 && bottom <= patrol.y + stompDepth)
      next = {
        ...next,
        cheers: next.cheers + 1,
        glooms: cheer(next.glooms, at, tick),
        hero: {
          ...next.hero,
          grounded: false,
          vy: state.controls.jump ? -bounceHeld : -bounce,
        },
      };
    else hurt = true;
  });
  if (
    level.thorns.some((thorn) =>
      touching(
        hero.x,
        hero.y,
        heroWidth,
        heroHeight,
        thorn.x,
        thorn.y,
        thornWidth,
        thornHeight,
      ),
    )
  )
    hurt = true;
  if (hurt && next.invulnerable === 0) next = lose(next, false);
  const here: HillsState = {
    ...next,
    checkpoint: next.checkpoint || next.hero.x >= level.checkpointX,
  };
  return here.hero.x + heroWidth >= level.goalX && !here.over
    ? cleared(here)
    : here;
}
