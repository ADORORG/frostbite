import type { JsonValue } from "@frostbite/game-sdk/protocol";
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

import {
  bufferTicks,
  cutSpeed,
  maxChoices,
  maxTicks,
  verifierId,
  verifierVersion,
} from "./constants.ts";
import { earnedBy } from "./milestones.ts";
import { startRun } from "./state.ts";
import { advanceTo, over } from "./tick.ts";
import type { RunState } from "./types.ts";

// SNOWBALL DASH's rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the platform
// replay a run it issued a seed for. The slope is laid out from the seed as the snowball comes to it; each tick it rolls on; the run
// record holds only when the player pressed or let go of the button.
//
// Inputs: `hop` `{ tick, on }` presses (`on` 1) or lets go of (`on` 0) the button on that tick; `end` `{ tick }` closes the run (a run that
// is not closed is not counted past its last choice). A run that has made `maxChoices` choices ends there.

function hop(state: RunState, data: JsonValue | undefined): Stepped<RunState> {
  return withFields(data, ["on", "tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    if (fields.on !== 0 && fields.on !== 1)
      return refuse("on must be 1 (pressed) or 0 (let go of)");
    const moved = advanceTo(state, tick);
    if (over(moved)) return refuse("the run is over");
    const pressed = fields.on === 1;
    if (moved.holding === pressed)
      return refuse(
        pressed ? "the button is already down" : "the button is already up",
      );
    const choices = moved.choices + 1;
    return {
      ok: true,
      state: {
        ...moved,
        buffer: pressed ? bufferTicks : moved.buffer,
        choices,
        ended: choices >= maxChoices,
        holding: pressed,
        vy: !pressed && moved.vy > cutSpeed ? cutSpeed : moved.vy,
      },
    };
  });
}

function finish(
  state: RunState,
  data: JsonValue | undefined,
): Stepped<RunState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...advanceTo(state, tick), ended: true } };
  });
}

export const snowballRules: GameVerifier<RunState> = {
  earned: earnedBy,
  id: verifierId,
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
