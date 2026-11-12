import {
  fieldsOf,
  refuse,
  tickNamed,
  withFields,
} from "@frostbite/game-sdk/run-inputs";
import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@frostbite/game-sdk/run-record";

import { act } from "./actions.ts";
import { advance } from "./advance.ts";
import { maxTicks, verifierVersion } from "./constants.ts";
import { readKeys } from "./keys.ts";
import { earnedBy } from "./milestones.ts";
import { startRun } from "./state.ts";
import type { PermafrostState } from "./types.ts";

// The rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the platform replay a run
// it issued a seed for. Pieces fall by the tick; the record holds only the keys the player pressed and when.
//
// Inputs: `keys` `{ keys }` is a batch of keys (see `keys.ts`), each on its tick after the one before; `end` `{ tick }` closes the run,
// which is then worth its score. A run that has not been closed has none.

function stepKeys(
  state: PermafrostState,
  data: RunInput["data"],
): Stepped<PermafrostState> {
  return withFields(data, ["keys"], (fields) => {
    const keys = readKeys(fields.keys);
    if (typeof keys === "string") return refuse(keys);
    let now = state;
    for (const { action, gap } of keys) {
      const tick = now.tick + gap;
      if (tick > maxTicks)
        return refuse(`tick must be from 0 to ${String(maxTicks)}`);
      now = act(advance(now, tick), action);
    }
    return { ok: true, state: now };
  });
}

function stepEnd(
  state: PermafrostState,
  data: RunInput["data"],
): Stepped<PermafrostState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    const last = advance(state, tick);
    return {
      ok: true,
      state: { ...last, cause: last.cause ?? "ended", ended: true },
    };
  });
}

export const permafrostRules: GameVerifier<PermafrostState> = {
  earned: earnedBy,
  id: "permafrost",
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startRun(seed) };
  },
  // The run's score, once it has ended: the number the game shows and keeps as the player's best.
  score: (state) => (state.ended ? state.score : null),
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    switch (input.type) {
      case "keys":
        return stepKeys(state, input.data);
      case "end":
        return stepEnd(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
