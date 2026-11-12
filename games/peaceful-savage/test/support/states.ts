import type { RunInput, Stepped } from "@frostbite/game-sdk/run-record";

import { breathInTicks, breathOutTicks } from "../../src/rules/constants.ts";
import { savageRules } from "../../src/rules/index.ts";
import { stepOf } from "../../src/rules/moment.ts";
import { choiceIds } from "../../src/rules/moments.ts";
import { startRun } from "../../src/rules/state.ts";
import { advanceTo } from "../../src/rules/tick.ts";
import type { PlayState } from "../../src/rules/types.ts";

// Small helpers for rule tests: a run already led, at a chosen place, and steps that must be accepted or refused.
export function led(overrides: Partial<PlayState> = {}, seed = 11): PlayState {
  return { ...startRun(seed), lead: "kai", ...overrides };
}

export function accepted(
  state: PlayState,
  type: string,
  fields: Record<string, number> = {},
): PlayState {
  const stepped: Stepped<PlayState> = savageRules.step(state, {
    data: { tick: state.tick, ...fields },
    type,
  });
  if (!stepped.ok) throw new Error(`${type} refused: ${stepped.reason}`);
  return stepped.state;
}

export function refusal(
  state: PlayState,
  type: string,
  fields: Record<string, number | string> = {},
): string {
  const stepped = savageRules.step(state, {
    data: { tick: state.tick, ...fields },
    type,
  });
  return stepped.ok ? "" : stepped.reason;
}

// Plays inputs from a seed, as the platform's replay would, and returns the state it ends in.
export function played(seed: number, inputs: readonly RunInput[]): PlayState {
  const init = savageRules.init(seed, {});
  if (!init.ok) throw new Error(init.reason);
  return inputs.reduce<PlayState>((state, input) => {
    const next = savageRules.step(state, input);
    if (!next.ok) throw new Error(next.reason);
    return next.state;
  }, init.state);
}

// A run with the lead standing just south of a point, facing it.
export const at = (
  state: PlayState,
  point: { x: number; z: number },
): PlayState => ({
  ...state,
  x: point.x,
  z: point.z + 600,
});

// Plays the moment the lead is in to its end: each beat on its mark, each breath held four counts and let go, each choice true.
export function playThrough(state: PlayState): PlayState {
  let now = state;
  for (let guard = 0; guard < 20 && now.moment !== null; guard += 1) {
    const step = stepOf(now);
    const moment = now.moment;
    if (step === null || moment === null) break;
    if (step.kind === "beat") {
      now = accepted(advanceTo(now, moment.target), "act");
    } else if (step.kind === "breath") {
      now = accepted(now, "act");
      now = accepted(advanceTo(now, now.tick + breathInTicks), "release");
      now = advanceTo(now, now.tick + breathOutTicks + 1);
    } else if (step.kind === "choose") {
      const truth = now.answers[choiceIds.indexOf(step.choice)] ?? 0;
      now = accepted(now, "choose", { option: truth });
    } else now = accepted(now, "act");
  }
  return now;
}
