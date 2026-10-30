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

import { maxTicks, verifierId, verifierVersion } from "./constants.ts";
import { startSnowball } from "./course.ts";
import { earnedBy } from "./milestones.ts";
import { advanceTo } from "./tick.ts";
import type { SnowballState } from "./types.ts";

// SNOWBALL DASH's rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the
// platform replay a run it issued a seed for. Each tick the snowball rolls on; the run record holds only what the player chose and
// on which tick.
//
// Inputs: `hop` `{ tick }` begins a hop on that tick (refused while one is going on); `end` `{ tick }` closes the run (a run that is
// not closed is not counted past its last choice).

function hop(
  state: SnowballState,
  data: JsonValue | undefined,
): Stepped<SnowballState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    const moved = advanceTo(state, tick);
    if (!moved.alive)
      return refuse(`the snowball hit a rock on tick ${String(moved.tick)}`);
    if (moved.finished) return refuse("the snowball has reached the foot");
    if (moved.air !== 0) return refuse("already in the air");
    return { ok: true, state: { ...moved, air: 1, hops: moved.hops + 1 } };
  });
}

function finish(
  state: SnowballState,
  data: JsonValue | undefined,
): Stepped<SnowballState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...advanceTo(state, tick), ended: true } };
  });
}

export const snowballRules: GameVerifier<SnowballState> = {
  earned: earnedBy,
  id: verifierId,
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startSnowball(seed) };
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    switch (input.type) {
      case "hop":
        return hop(state, input.data);
      case "end":
        return finish(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
