import { touching } from "./collide.ts";
import {
  bounce,
  bounceHeld,
  gloomHeight,
  gloomWidth,
  heroHeight,
  heroWidth,
  stompDepth,
  thornHeight,
  thornWidth,
} from "./constants.ts";
import type { Moved } from "./hero.ts";
import { obstacles } from "./secrets.ts";
import type { Gloom, HillsState } from "./types.ts";

// What Glitchy bumped into this tick, once it has moved. A gloomling landed on is cheered up and Glitchy bounces (higher with jump
// held); one bumped into while the forcefield is up is cheered up too; any other bump, a thorn bush, a puffing vent or a boulder's side
// hurts. Landing on a boulder bounces. A thorn bush or a boulder a glitch blast took away is gone.
export const cheer = (
  glooms: readonly Gloom[],
  at: number,
  tick: number,
): readonly Gloom[] =>
  glooms.map((gloom, index) =>
    index === at ? { ...gloom, alive: false, cheered: tick } : gloom,
  );

export function touchHero(
  state: HillsState,
  moved: Moved,
  bottom: number,
): { readonly hurt: boolean; readonly state: HillsState } {
  const { hero, level, tick } = state;
  const springBack = state.controls.jump ? -bounceHeld : -bounce;
  let next = state;
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
    const stomped = moved.falling > 0 && bottom <= patrol.y + stompDepth;
    if (stomped || next.forcefield > 0)
      next = {
        ...next,
        cheers: next.cheers + 1,
        glooms: cheer(next.glooms, at, tick),
        hero: stomped
          ? { ...next.hero, grounded: false, vy: springBack }
          : next.hero,
      };
    else hurt = true;
  });
  if (
    level.thorns.some(
      (thorn, at) =>
        state.thornsGone[at] !== true &&
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
  const hit = obstacles(
    level,
    hero,
    tick,
    moved.falling,
    bottom,
    state.rollersGone,
  );
  if (hit.bounced)
    next = { ...next, hero: { ...next.hero, grounded: false, vy: springBack } };
  return { hurt: hurt || hit.hurt, state: next };
}
