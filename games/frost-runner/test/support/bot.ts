import type { RunInput } from "@ador/game-sdk/run-record";

import { runnerRules } from "../../src/rules/index.ts";
import { advanceTo } from "../../src/rules/tick.ts";
import type { RunnerState } from "../../src/rules/types.ts";
import { startRunner } from "../../src/rules/world.ts";

// A player that never mistimes anything it can see: for the next obstacle it works out every tick on which a jump (or a slide) would
// get it through, and acts on the middle one, so there is the most room either side. It stands for the best a person could do, so a run
// it cannot get through is a game that cannot be played; and the inputs it makes are a legal run record to replay.
const window = 90;

export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: RunnerState;
}

// Whether doing `kind` after `wait` ticks gets past the obstacle that is next now (the run must still be going after it has gone by).
function gets(
  state: RunnerState,
  kind: "jump" | "slide",
  wait: number,
): boolean {
  const target = state.cleared + 1;
  const later = advanceTo(state, state.tick + wait);
  const stepped = runnerRules.step(later, {
    data: { tick: later.tick },
    type: kind,
  });
  if (!later.alive || !stepped.ok) return false;
  let current = stepped.state;
  for (let at = 0; at < window && current.cleared < target; at += 1)
    current = advanceTo(current, current.tick + 1);
  return current.alive && current.cleared >= target;
}

// The tick on which to act for the obstacle that is next: the middle of those on which acting would work, seen from now.
function planFor(
  state: RunnerState,
): { kind: "jump" | "slide"; at: number } | null {
  const next = state.obstacles[0];
  if (next === undefined || state.action.kind !== "none") return null;
  const kind = next.kind === "spike" ? "jump" : "slide";
  const waits: number[] = [];
  for (let wait = 0; wait < window; wait += 1)
    if (gets(state, kind, wait)) waits.push(wait);
  const middle = waits[Math.floor(waits.length / 2)];
  return middle === undefined ? null : { at: state.tick + middle, kind };
}

export function play(seed: number, ticks: number): Played {
  let state = startRunner(seed);
  const inputs: RunInput[] = [];
  let plan: { kind: "jump" | "slide"; at: number } | null = null;
  while (state.alive && state.tick < ticks) {
    plan ??= planFor(state);
    if (plan !== null && plan.at <= state.tick) {
      const input = { data: { tick: state.tick }, type: plan.kind };
      plan = null;
      const stepped = runnerRules.step(state, input);
      if (!stepped.ok) throw new Error(stepped.reason);
      state = stepped.state;
      inputs.push(input);
    }
    state = advanceTo(state, state.tick + 1);
  }
  const end = { data: { tick: state.tick }, type: "end" };
  const closed = runnerRules.step(state, end);
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, end], state: closed.state };
}
