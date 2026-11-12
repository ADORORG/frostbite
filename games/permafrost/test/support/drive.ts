import type { RunInput } from "@frostbite/game-sdk/run-record";

import { permafrostRules } from "../../src/rules/index.ts";
import type { PermafrostState } from "../../src/rules/types.ts";

// The rules' own step, asked to succeed: the state after the keys are pressed (or the run closed), or the reason it was refused.
export function press(state: PermafrostState, keys: string): PermafrostState {
  return stepped(state, { data: { keys }, type: "keys" });
}

export function close(
  state: PermafrostState,
  tick = state.tick,
): PermafrostState {
  return stepped(state, { data: { tick }, type: "end" });
}

export function stepped(
  state: PermafrostState,
  input: RunInput,
): PermafrostState {
  const result = permafrostRules.step(state, input);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
