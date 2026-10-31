import type { RunInput } from "@ador/game-sdk/run-record";

import { heroWidth, maxTicks, tile } from "../../src/rules/hills/constants.ts";
import { hillsRules } from "../../src/rules/hills/index.ts";
import { eggsCaught } from "../../src/rules/hills/milestones.ts";
import { freshStage, startHills } from "../../src/rules/hills/state.ts";
import { tickHills } from "../../src/rules/hills/tick.ts";
import type { HillsControl, HillsState } from "../../src/rules/hills/types.ts";

// A player who sees what is coming, for Egg Hills: every tick it tries, on a copy of the run played through the real rules, running on
// and each of several jumps, and does what keeps Glitchy safe over the next `horizon` ticks while getting furthest (a golden egg, a
// cheered gloomling and an egg count for something too). It breathes fire at ice ahead. It stands for a good player: a stage it clears
// without losing a heart is a stage that can be cleared that way, and the inputs it makes are a legal run to replay.
const horizon = 70;
const holds = [7, 12, 18, 25, 33, 42] as const;

export const pressOn = (
  state: HillsState,
  key: HillsControl,
  on: boolean,
): HillsState => {
  const stepped = hillsRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: key,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
};

function score(from: HillsState, ticks: number): number | null {
  let now = ticks > 0 ? pressOn(from, "jump", true) : from;
  for (let at = 0; at < horizon; at += 1) {
    if (ticks > 0 && at === ticks && now.controls.jump)
      now = pressOn(now, "jump", false);
    now = tickHills(now);
    if (now.stage > from.stage || now.finishTick !== null) return 1_000_000;
    if (now.hearts < from.hearts || now.over) return null;
  }
  const gained = now.hero.x - from.hero.x;
  const golden = now.goldens - from.goldens;
  if (gained < 600 && golden === 0) return null;
  return (
    gained +
    4_000 * golden +
    300 * (now.cheers - from.cheers) +
    60 * (eggsCaught(now) - eggsCaught(from))
  );
}

// Ice ahead in the band Glitchy breathes along, close enough to melt.
function iceAhead(state: HillsState): boolean {
  const { hero, level } = state;
  const front = Math.floor((hero.x + heroWidth) / tile);
  const row = Math.floor((hero.y + 64) / tile);
  return level.ice.some(
    (cell, at) =>
      state.melted[at] !== true &&
      cell.row === row &&
      cell.column >= front &&
      cell.column <= front + 5,
  );
}

export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: HillsState;
}

export const startStage = (seed: number, stage: number): HillsState => ({
  ...startHills(seed),
  ...freshStage(seed, stage),
  hasFire: true,
  stage,
});

export function planHills(
  from: HillsState,
  until: (state: HillsState) => boolean = () => false,
  limit = maxTicks,
): Played {
  let state = from;
  const inputs: RunInput[] = [];
  const press = (key: HillsControl, on: boolean): void => {
    const data = { on: on ? 1 : 0, tick: state.tick };
    state = pressOn(state, key, on);
    inputs.push({ data, type: key });
  };
  let releaseAt = -1;
  press("right", true);
  while (
    state.tick < limit &&
    !state.over &&
    state.finishTick === null &&
    !until(state)
  ) {
    if (state.controls.jump && state.tick >= releaseAt) press("jump", false);
    if (state.controls.fire) press("fire", false);
    else if (
      state.hasFire &&
      state.fireCooldown === 0 &&
      state.fireballs.length === 0 &&
      iceAhead(state)
    )
      press("fire", true);
    if (
      (state.hero.grounded || state.hero.coyote > 0) &&
      !state.controls.jump
    ) {
      let best = { score: score(state, 0) ?? -1, ticks: 0 };
      for (const ticks of holds) {
        const tried = score(state, ticks);
        if (tried !== null && tried > best.score + 200)
          best = { score: tried, ticks };
      }
      if (best.ticks > 0) {
        press("jump", true);
        releaseAt = state.tick + best.ticks;
      }
    }
    state = tickHills(state);
  }
  const data = { tick: state.tick };
  const closed = hillsRules.step(state, { data, type: "end" });
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, { data, type: "end" }], state: closed.state };
}

export const playHills = (seed: number): Played => planHills(startHills(seed));
