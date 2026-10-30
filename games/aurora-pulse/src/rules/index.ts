import type { JsonValue } from "@ador/game-sdk/protocol";
import {
  fieldsOf,
  refuse,
  tickNamed,
  withFields,
} from "@ador/game-sdk/run-inputs";
import type {
  GameVerifier,
  RunInput,
  Stepped,
} from "@ador/game-sdk/run-record";

import { lanes, maxTicks, verifierId, verifierVersion } from "./constants.ts";
import { hitOnce } from "./hit.ts";
import { earnedBy } from "./milestones.ts";
import { startRun, type PulseState } from "./state.ts";
import { advanceTo } from "./tick.ts";

// AURORA PULSE's rules, as a pure state machine: the same seed and taps always play out the same way, which is what lets the platform replay a
// run it issued a seed for. The chart is made from the seed as the run goes on; each tick the notes that have gone by are missed; the run record
// holds only the taps. Inputs: `hit` `{ lane, tick }` taps a lane (0 to 3) on that tick; `end` `{ tick }` closes the run (a run that is not
// closed is counted as far as its last tap). A tap on a tick before the one the run has reached is refused.
function hit(
  state: PulseState,
  data: JsonValue | undefined,
): Stepped<PulseState> {
  return withFields(data, ["lane", "tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    const { lane } = fields;
    if (
      typeof lane !== "number" ||
      !Number.isInteger(lane) ||
      lane < 0 ||
      lane >= lanes
    )
      return refuse("lane must be 0, 1, 2 or 3");
    const there = advanceTo(state, tick);
    return there.ended
      ? refuse("the run is over")
      : { ok: true, state: hitOnce(there, lane) };
  });
}

function finish(
  state: PulseState,
  data: JsonValue | undefined,
): Stepped<PulseState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...advanceTo(state, tick), ended: true } };
  });
}

export const pulseRules: GameVerifier<PulseState> = {
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
      case "hit":
        return hit(state, input.data);
      case "end":
        return finish(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
