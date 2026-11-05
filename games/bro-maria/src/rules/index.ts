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

import { maxTicks, verifierId, verifierVersion } from "./constants.ts";
import { pressJump } from "./hero.ts";
import { earnedBy } from "./milestones.ts";
import { startRun } from "./state.ts";
import { advanceTo } from "./tick.ts";
import type { State } from "./types.ts";

// BRO MARIA's rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the platform
// replay a run it issued a seed for. The level is laid out from the seed; each tick the hero carries on with what the player is holding;
// the run record holds only when the player pressed or let go of a key.
//
// Inputs: `left`, `right` and `jump` `{ tick, on }` press (`on` 1) or release (`on` 0) that control on that tick; `end` `{ tick }` closes
// the run (a run that is not closed is not counted past its last choice). Once the hero has lost its last life or reached the goal only
// `end` is taken.

type Held = "jump" | "left" | "right";

function hold(
  state: State,
  key: Held,
  data: JsonValue | undefined,
): Stepped<State> {
  return withFields(data, ["on", "tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    if (fields.on !== 0 && fields.on !== 1)
      return refuse("on must be 1 (pressed) or 0 (released)");
    const moved = advanceTo(state, tick);
    if (moved.over || moved.finishTick !== null)
      return refuse("the run is over");
    const on = fields.on === 1;
    if (moved.controls[key] === on)
      return refuse(`${key} is already ${on ? "held" : "released"}`);
    return {
      ok: true,
      state: {
        ...moved,
        controls: { ...moved.controls, [key]: on },
        hero: key === "jump" && on ? pressJump(moved.hero) : moved.hero,
      },
    };
  });
}

function finish(state: State, data: JsonValue | undefined): Stepped<State> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...advanceTo(state, tick), ended: true } };
  });
}

export const broRules: GameVerifier<State> = {
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
      case "left":
      case "right":
      case "jump":
        return hold(state, input.type, input.data);
      case "end":
        return finish(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
