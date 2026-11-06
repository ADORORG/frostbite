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

import { maxTicks, verifierId, verifierVersion } from "./constants.ts";
import { earnedBy } from "./milestones.ts";
import { catchAt, startRun } from "./state.ts";
import type { StarterState } from "./types.ts";

// The rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the platform replay a run it
// issued a seed for. A marker sweeps to and fro along a lane and the run record holds only when the player tapped.
//
// Inputs: `tap` `{ tick }` taps on that tick (after the last tap, and never after the longest a run may last); `end` `{ tick }` closes the
// run (a run that is not closed counts as it stands). A tap while the marker is out of the zone ends the run.

function tap(
  state: StarterState,
  data: RunInput["data"],
): Stepped<StarterState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    if (tick <= state.lastTap)
      return refuse("a tap cannot come on or before the last tap's tick");
    return { ok: true, state: catchAt(state, tick) };
  });
}

function finish(
  state: StarterState,
  data: RunInput["data"],
): Stepped<StarterState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...state, cause: "timeout", ended: true, tick } };
  });
}

export const starterRules: GameVerifier<StarterState> = {
  earned: earnedBy,
  id: verifierId,
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startRun(seed) };
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    switch (input.type) {
      case "tap":
        return tap(state, input.data);
      case "end":
        return finish(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
