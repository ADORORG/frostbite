import { startRun } from "../../src/rules/state.ts";
import { advanceTo } from "../../src/rules/tick.ts";
import { snowballRules } from "../../src/rules/index.ts";
import type { Obstacle, RunState } from "../../src/rules/types.ts";

// A run on an empty slope (nothing laid, and nothing will be: the next pattern is out of reach), with anything else about it changed.
export const bare = (over: Partial<RunState> = {}): RunState => ({
  ...startRun(1),
  ahead: [],
  nextAt: Number.MAX_SAFE_INTEGER,
  shards: [],
  ...over,
});

export const rock = (x: number): Obstacle => ({
  h: 48,
  kind: "rock",
  w: 60,
  x,
});
export const boulder = (x: number): Obstacle => ({
  h: 144,
  kind: "boulder",
  w: 96,
  x,
});
export const spikes = (x: number): Obstacle => ({
  h: 30,
  kind: "spikes",
  w: 216,
  x,
});
export const pit = (x: number, w: number): Obstacle => ({
  h: 0,
  kind: "pit",
  w,
  x,
});

// The button goes down (or up) on the tick the run has reached.
export function press(state: RunState, on: boolean): RunState {
  const stepped = snowballRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: "hop",
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
}

export const roll = (state: RunState, ticks: number): RunState =>
  advanceTo(state, state.tick + ticks);

// A hop held for `hold` ticks, then let go of, and rolled on until it has landed.
export function hop(state: RunState, hold: number): RunState {
  let current = roll(press(state, true), hold);
  current = roll(press(current, false), 1);
  for (let tick = 0; tick < 200 && (current.y > 0 || current.vy > 0); tick += 1)
    current = roll(current, 1);
  return current;
}
