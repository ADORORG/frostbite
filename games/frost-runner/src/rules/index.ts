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
import { earnedBy } from "./milestones.ts";
import { advanceTo } from "./tick.ts";
import type { RunnerState } from "./types.ts";
import { startRunner } from "./world.ts";

// FROST RUNNER's rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the
// platform replay a run it issued a seed for. Each tick the world scrolls and the runner carries on with what it was doing; the run
// record holds only what the player chose and on which tick.
//
// Inputs: `jump` `{ tick }` and `slide` `{ tick }` begin that action on that tick (refused while another is going on); `end` `{ tick }`
// closes the run (a run that is not closed is not counted past its last choice).

function begin(
  state: RunnerState,
  kind: "jump" | "slide",
  data: JsonValue | undefined,
): Stepped<RunnerState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    const moved = advanceTo(state, tick);
    if (!moved.alive)
      return refuse(`the runner was stopped on tick ${String(moved.tick)}`);
    if (moved.action.kind !== "none")
      return refuse(
        `already ${moved.action.kind === "jump" ? "jumping" : "sliding"}`,
      );
    return {
      ok: true,
      state: {
        ...moved,
        action: { kind, tick: 0 },
        jumps: moved.jumps + (kind === "jump" ? 1 : 0),
        slides: moved.slides + (kind === "slide" ? 1 : 0),
      },
    };
  });
}

function finish(
  state: RunnerState,
  data: JsonValue | undefined,
): Stepped<RunnerState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...advanceTo(state, tick), ended: true } };
  });
}

export const runnerRules: GameVerifier<RunnerState> = {
  earned: earnedBy,
  id: verifierId,
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startRunner(seed) };
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    switch (input.type) {
      case "jump":
        return begin(state, "jump", input.data);
      case "slide":
        return begin(state, "slide", input.data);
      case "end":
        return finish(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
