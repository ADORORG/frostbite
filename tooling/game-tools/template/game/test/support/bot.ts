import type { RunInput } from "@frostbite/game-sdk/run-record";

import { zoneHalfWidth } from "../../src/rules/constants.ts";
import { starterRules } from "../../src/rules/index.ts";
import { advance } from "../../src/rules/state.ts";
import type { StarterState } from "../../src/rules/types.ts";

// A player that is never wrong, and one that always is, for tests that need a run to go a certain way.
const inZone = (state: StarterState, tick: number): boolean => {
  const at = advance(state, tick);
  return Math.abs(at.position - at.zone) <= zoneHalfWidth;
};

// The first tick after the last tap on which a tap would catch, or would miss.
function firstTick(state: StarterState, catches: boolean): number {
  for (let tick = Math.max(state.tick, state.lastTap + 1); ; tick += 1)
    if (inZone(state, tick) === catches) return tick;
}
export const catchTick = (state: StarterState): number =>
  firstTick(state, true);
export const missTick = (state: StarterState): number =>
  firstTick(state, false);

export function started(seed: number): StarterState {
  const init = starterRules.init(seed, {});
  if (!init.ok) throw new Error(init.reason);
  return init.state;
}

// Plays `catches` catches on a seed, and then misses if `thenMiss`.
export function play(seed: number, catches: number, thenMiss = false) {
  let state = started(seed);
  const inputs: RunInput[] = [];
  const tap = (tick: number): void => {
    const data = { tick };
    const stepped = starterRules.step(state, { data, type: "tap" });
    if (!stepped.ok) throw new Error(stepped.reason);
    state = stepped.state;
    inputs.push({ data, type: "tap" });
  };
  for (let at = 0; at < catches; at += 1) tap(catchTick(state));
  if (thenMiss) tap(missTick(state));
  return { inputs, state };
}
