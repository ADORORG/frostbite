import { pullPlasma } from "../plasma.ts";
import { fireAtBoss, meetBoss } from "./boss-meet.ts";
import { moveBoss } from "./boss.ts";
import {
  berrySize,
  bounce,
  bounceHeld,
  charmSize,
  eggSize,
  heartStages,
  heroHeight,
  heroWidth,
  hitKnock,
  invulnerableTicks,
  magnetReach,
  maxHearts,
  plasmaCatch,
  plasmaReach,
  plasmaSpeed,
  rows,
  shieldTicks,
  stages,
  tile,
} from "./constants.ts";
import { touching } from "./collide.ts";
import { fly } from "./fire.ts";
import { moveHero } from "./hero.ts";
import { doors, pickUp, sectionOf, sprung } from "./secrets.ts";
import { freshStage, startHero } from "./state.ts";
import { cheer, touchHero } from "./touch.ts";
import type { Gloom, Hero, HillsState, Spot } from "./types.ts";
import { feelOf } from "./weather.ts";

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

// The stage's secret charm: a feather (stronger jumps) in stage one, a shield (one hit taken for Glitchy) in stage two, a magnet
// (metaplasma from much farther) in stage three.
function charmOf(state: HillsState): HillsState {
  if (state.charmTaken || !heroOn(state.hero, state.level.charm, charmSize))
    return state;
  const found = { ...state, charmTaken: true, charms: state.charms + 1 };
  if (state.stage === 1) return { ...found, feather: true };
  return state.stage === 2
    ? { ...found, shield: true }
    : { ...found, magnet: true };
}

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
    plasmaBanked: state.plasmaBanked + state.plasma.gathered,
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

// One tick of Egg Hills: Glitchy moves, the gloomlings walk, the fire flies; then what Glitchy touched is settled, and last, a door
// into or out of a secret area takes Glitchy through. While Glitchy is in a secret area, DeFu's fight waits.
export function tickHills(state: HillsState): HillsState {
  if (state.over || state.finishTick !== null)
    return { ...state, tick: state.tick + 1 };
  const { level } = state;
  const tick = state.tick + 1;
  const inMain = sectionOf(state.hero.x) === "main";
  const moved = moveHero(
    level,
    state.melted,
    state.hero,
    state.controls,
    feelOf(state),
  );
  const hero = sprung(level, moved.hero);
  let glooms = walk(state);
  const flown = fly(state, glooms);
  for (const at of flown.cheered) glooms = cheer(glooms, at, tick);
  const fired = inMain
    ? fireAtBoss(
        moveBoss(state.boss, hero, state.stage, tick),
        flown.fireballs,
        tick,
      )
    : { boss: state.boss, cheered: 0, fireballs: flown.fireballs };
  let next: HillsState = pickUp(
    charmOf({
      ...state,
      boss: fired.boss,
      cheers: state.cheers + flown.cheered.length,
      fireCooldown: Math.max(0, state.fireCooldown - 1),
      fireballs: fired.fireballs,
      forcefield: Math.max(0, state.forcefield - 1),
      glooms,
      guardsCheered: state.guardsCheered + fired.cheered,
      hero,
      invulnerable: Math.max(0, state.invulnerable - 1),
      melted: flown.melted,
      meltedCount: state.meltedCount + flown.newlyMelted,
      plasma: pullPlasma(
        state.plasma,
        level.motes,
        hero.x + heroWidth / 2,
        hero.y + heroHeight / 2,
        {
          catchWithin: plasmaCatch,
          reach: state.magnet ? magnetReach : plasmaReach,
          speed: plasmaSpeed,
        },
      ),
      tick,
      wings: Math.max(0, state.wings - 1),
    }),
  );
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
  if (hero.y > rows * tile)
    return sectionOf(hero.x) === "sky" ? doors(next) : lose(next, true);
  const bottom = state.hero.y + heroHeight;
  const touched = touchHero(next, moved, bottom);
  next = touched.state;
  const met = inMain
    ? meetBoss(
        next.boss,
        next.hero,
        bottom,
        moved.falling,
        state.stage,
        tick,
        next.forcefield > 0,
      )
    : { boss: next.boss, bounced: false, caught: 0, cheered: 0, hurt: false };
  next = {
    ...next,
    boss: met.boss,
    freedCaught: next.freedCaught + met.caught,
    guardsCheered: next.guardsCheered + met.cheered,
    hero: met.bounced
      ? {
          ...next.hero,
          grounded: false,
          vy: state.controls.jump ? -bounceHeld : -bounce,
        }
      : next.hero,
  };
  if (
    (touched.hurt || met.hurt) &&
    next.invulnerable === 0 &&
    next.forcefield === 0
  )
    next = next.shield
      ? { ...next, invulnerable: shieldTicks, shield: false }
      : lose(next, false);
  const here: HillsState = {
    ...next,
    checkpoint: next.checkpoint || (inMain && next.hero.x >= level.checkpointX),
  };
  return inMain &&
    here.hero.x + heroWidth >= level.goalX &&
    here.boss.beaten >= 0 &&
    !here.over
    ? cleared(here)
    : doors(here);
}
