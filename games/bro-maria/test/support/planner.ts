import type { RunInput } from "@ador/game-sdk/run-record";

import { broRules } from "../../src/rules/index.ts";
import { freshStage, startRun } from "../../src/rules/state.ts";
import { tickOnce } from "../../src/rules/tick.ts";
import type { State } from "../../src/rules/types.ts";

// A player who sees what is coming: every tick it tries, on a copy of the game played through the real rules, running on and each of several
// jumps (pressed now, held for a number of ticks), and does what keeps the hero out of harm over the next `horizon` ticks, preferring to run
// on. It stands for a good player; a stage it can clear without losing a life is a stage that can be cleared.
const horizon = 70;
const holds = [7, 12, 18, 25, 33, 42] as const;

const hold = (state: State, key: "jump" | "right", on: boolean): State => {
  const stepped = broRules.step(state, {
    data: { on: on ? 1 : 0, tick: state.tick },
    type: key,
  });
  if (!stepped.ok) throw new Error(stepped.reason);
  return stepped.state;
};

// The least the hero must gain in the horizon for a plan to count as getting on (a hero held up by a wall of ice is not getting on).
const progress = 700;

// How far the hero gets, with what it takes on the way, over the horizon, or null if it is hurt, falls or is held up.
function tryHold(state: State, ticks: number): number | null {
  let now = ticks > 0 ? hold(state, "jump", true) : state;
  for (let at = 0; at < horizon; at += 1) {
    if (ticks > 0 && at === ticks && now.controls.jump)
      now = hold(now, "jump", false);
    now = tickOnce(now);
    if (now.stage > state.stage || now.finishTick !== null) return 1_000_000;
    if (now.lives < state.lives || now.over) return null;
  }
  return now.hero.x - state.hero.x < progress
    ? null
    : now.hero.x + 300 * (now.stomps - state.stomps);
}

export interface Played {
  readonly inputs: readonly RunInput[];
  readonly state: State;
}

// The state a stage begins in (with the lives and the rest as a fresh run's), to play one stage on its own.
export const startStage = (seed: number, stage: number): State => ({
  ...startRun(seed),
  ...freshStage(seed, stage),
  stage,
});

// Plays from `from` until `until` says to stop (or the hero is out of lives or time), choosing the controls each tick. The inputs are a
// legal run record when `from` is the start of a run.
export function plan(
  from: State,
  until: (state: State) => boolean,
  limit = 28_800,
): Played {
  let state = from;
  const inputs: RunInput[] = [];
  const press = (key: "jump" | "right", on: boolean): void => {
    const data = { on: on ? 1 : 0, tick: state.tick };
    state = hold(state, key, on);
    inputs.push({ data, type: key });
  };
  let releaseAt = -1;
  if (!state.controls.right) press("right", true);
  while (
    state.tick < limit &&
    !state.over &&
    state.finishTick === null &&
    !until(state)
  ) {
    if (state.controls.jump && state.tick >= releaseAt) press("jump", false);
    if (
      (state.hero.grounded || state.hero.coyote > 0) &&
      !state.controls.jump
    ) {
      const stay = tryHold(state, 0);
      if (stay === null) {
        let best: { score: number; ticks: number } | null = null;
        for (const ticks of holds) {
          const score = tryHold(state, ticks);
          if (score !== null && (best === null || score > best.score))
            best = { score, ticks };
        }
        if (best !== null) {
          press("jump", true);
          releaseAt = state.tick + best.ticks;
        }
      }
    }
    state = tickOnce(state);
  }
  const data = { tick: state.tick };
  const closed = broRules.step(state, { data, type: "end" });
  if (!closed.ok) throw new Error(closed.reason);
  return { inputs: [...inputs, { data, type: "end" }], state: closed.state };
}

export const playRun = (seed: number): Played =>
  plan(startRun(seed), () => false);
export const playStageOnce = (seed: number, stage: number): Played =>
  plan(startStage(seed, stage), (state) => state.stagesCleared > 0, 6_000);
