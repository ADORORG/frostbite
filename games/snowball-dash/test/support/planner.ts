import type { RunInput } from "@frostbite/game-sdk/run-record";

import { levelAt, speedAt } from "../../src/rules/course.ts";
import { snowballRules } from "../../src/rules/index.ts";
import { startRun } from "../../src/rules/state.ts";
import { advanceTo, over, tickOnce } from "../../src/rules/tick.ts";
import { earnedBy } from "../../src/rules/milestones.ts";
import type { RunState } from "../../src/rules/types.ts";

// A player who sees the whole course ahead and the rules it is played by: before each obstacle it tries every moment to press the button and
// every length to hold it, plays each out to the far side of the obstacle, and keeps the one that scores most and still leaves a way on. If
// such a player survives a course, a legal run does; if it cannot, the course is unfair. It is a test tool, not part of the game.
export interface Plan {
  readonly hold: number;
  readonly wait: number;
}

const resolved = (state: RunState): number =>
  state.cleared.rock +
  state.cleared.boulder +
  state.cleared.pit +
  state.cleared.spikes;

const grounded = (state: RunState): boolean => state.y === 0 && state.vy === 0;

const press = (state: RunState, on: 0 | 1): RunState | null => {
  const stepped = snowballRules.step(state, {
    data: { on, tick: state.tick },
    type: "hop",
  });
  return stepped.ok ? stepped.state : null;
};

// Plays a plan from `state` until the next obstacle has been dealt with and the snowball is back on the snow. Null if it dies, or the plan
// is not a legal thing to do. `log` receives the inputs it makes.
export function execute(
  state: RunState,
  plan: Plan,
  log?: RunInput[],
): RunState | null {
  const goal = resolved(state) + 1;
  let current = advanceTo(state, state.tick + plan.wait);
  if (over(current)) return null;
  const down = press(current, 1);
  if (down === null) return null;
  log?.push({ data: { on: 1, tick: current.tick }, type: "hop" });
  current = advanceTo(down, down.tick + plan.hold);
  if (over(current)) return null;
  const up = press(current, 0);
  if (up === null) return null;
  log?.push({ data: { on: 0, tick: current.tick }, type: "hop" });
  current = up;
  for (let extra = 0; extra < 400; extra += 1) {
    if (over(current)) return null;
    if (resolved(current) >= goal && grounded(current)) return current;
    current = tickOnce(current);
  }
  return null;
}

function candidates(state: RunState): Plan[] {
  const next = state.ahead.find(
    ({ kind, w, x }) => kind !== "pit" || x + w > state.distance,
  );
  const speed = speedAt(levelAt(state.distance));
  const first =
    next === undefined
      ? 0
      : Math.max(0, Math.floor((next.x - 1_100 - state.distance) / speed));
  const plans: Plan[] = [];
  for (let wait = first; wait <= first + 80; wait += 2)
    for (let hold = 2; hold <= 60; hold += 3) plans.push({ hold, wait });
  return plans;
}

// Whether the snowball can get through the next `depth` obstacles from here.
function survivable(state: RunState, depth: number): boolean {
  if (depth === 0) return true;
  return candidates(state).some((plan) => {
    const next = execute(state, plan);
    return next !== null && survivable(next, depth - 1);
  });
}

export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: RunState;
}

// Plays a seed until the snowball dies, `limit` ticks pass, or it can find no way on.
export function play(seed: number, limit: number): Played {
  let state = startRun(seed);
  const inputs: RunInput[] = [];
  while (!over(state) && state.tick < limit) {
    let best: { plan: Plan; score: number; state: RunState } | null = null;
    for (const plan of candidates(state)) {
      const next = execute(state, plan);
      if (next === null) continue;
      if (best !== null && next.score <= best.score) continue;
      if (survivable(next, 1)) best = { plan, score: next.score, state: next };
    }
    if (best === null) break;
    const made: RunInput[] = [];
    state = execute(state, best.plan, made) ?? state;
    inputs.push(...made);
  }
  return { inputs, state };
}

export const earnedIds = (played: Played): readonly string[] =>
  earnedBy(played.state);
