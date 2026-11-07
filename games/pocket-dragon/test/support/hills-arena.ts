import { heroWidth } from "../../src/rules/hills/constants.ts";
import { hillsRules } from "../../src/rules/hills/index.ts";
import { tickHills } from "../../src/rules/hills/tick.ts";
import type { HillsControl, HillsState } from "../../src/rules/hills/types.ts";

// How a player who sees what is coming fights the boss: every other tick it tries each way to go (left, stay, right), each jump (none,
// a hop, a jump) and whether to breathe fire, on a copy of the fight played through the real rules for `horizon` ticks, and does the
// first step of whichever beats the most of the boss without Glitchy being hit (a lasers' mark is a hit to come, within the horizon).
const horizon = 54;
const jumps = [0, 10, 22, 40] as const;

export interface Choice {
  readonly dir: -1 | 0 | 1;
  readonly fire: boolean;
  readonly jump: number;
}

const set = (
  state: HillsState,
  control: HillsControl,
  on: boolean,
): HillsState => {
  if (state.controls[control] === on) return state;
  const stepped = hillsRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: control,
  });
  return stepped.ok ? stepped.state : state;
};

const bossLeft = (state: HillsState): number =>
  state.boss.ghosts.reduce((sum, ghost) => sum + Math.max(0, ghost.hp), 0) +
  Math.max(0, state.boss.rocket?.hp ?? 0);

export const hit = (now: HillsState, from: HillsState): boolean =>
  now.heartsLost > from.heartsLost || (from.shield && !now.shield) || now.over;

function tryChoice(from: HillsState, choice: Choice): number {
  let now = set(set(from, "left", choice.dir < 0), "right", choice.dir > 0);
  const grounded = now.hero.grounded || now.hero.coyote > 0;
  if (choice.jump > 0) now = set(now, "jump", true);
  if (choice.fire) now = set(now, "fire", true);
  for (let at = 0; at < horizon; at += 1) {
    if (at === choice.jump && now.controls.jump) now = set(now, "jump", false);
    if (at === 1 && now.controls.fire) now = set(now, "fire", false);
    now = tickHills(now);
    if (hit(now, from)) return -1_000_000_000 + at * 1_000;
    if (now.boss.beaten >= 0) return 100_000_000 - at;
  }
  const middle = now.hero.x + heroWidth / 2;
  const ghost = now.boss.ghosts.find((g) => g.hp > 0) ?? now.boss.rocket;
  const near =
    ghost === null || ghost === undefined ? 0 : Math.abs(ghost.x - middle);
  return (
    10_000 * (bossLeft(from) - bossLeft(now)) +
    12_000 * (now.guardsCheered - from.guardsCheered) +
    2_000 * (now.freedCaught - from.freedCaught) -
    Math.floor(near / 64) -
    (choice.jump > 0 && !grounded ? 50 : 0)
  );
}

export function arenaChoice(state: HillsState): Choice {
  const canFire =
    state.hasFire &&
    state.fireCooldown === 0 &&
    state.fireballs.length < 2 &&
    !state.controls.fire;
  const grounded =
    (state.hero.grounded || state.hero.coyote > 0) && !state.controls.jump;
  let best: Choice = { dir: 0, fire: false, jump: 0 };
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const dir of [0, 1, -1] as const)
    for (const jump of grounded ? jumps : [0])
      for (const fire of canFire ? [true, false] : [false]) {
        const choice = { dir, fire, jump };
        const scored = tryChoice(state, choice);
        if (scored > bestScore) {
          best = choice;
          bestScore = scored;
        }
      }
  return best;
}

// After the fight, the nearest freed egg that has landed, to walk to before the portal.
export function eggToFetch(state: HillsState): number | null {
  const landed = state.boss.freed.filter(
    (egg) => !egg.caught && egg.vx === 0 && egg.vy === 0,
  );
  if (landed.length === 0) return null;
  const middle = state.hero.x + heroWidth / 2;
  return landed.reduce(
    (best, egg) =>
      Math.abs(egg.x - middle) < Math.abs(best - middle) ? egg.x : best,
    landed[0]?.x ?? middle,
  );
}
