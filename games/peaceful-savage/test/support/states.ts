import type { RunInput, Stepped } from "@frostbite/game-sdk/run-record";

import { savageRules } from "../../src/rules/index.ts";
import { startRun } from "../../src/rules/state.ts";
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
