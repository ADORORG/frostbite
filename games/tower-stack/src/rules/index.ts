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

import { dropAt } from "./drop.ts";
import { maxTicks, verifierId, verifierVersion } from "./constants.ts";
import { earnedBy } from "./milestones.ts";
import { startTower } from "./state.ts";
import type { TowerState } from "./types.ts";

// TOWER STACKER's rules, as a pure state machine: the same seed and inputs always play out the same way, which is what lets the platform
// replay a run it issued a seed for. A block slides to and fro over the tower and the run record holds only when the player dropped it.
//
// Inputs: `drop` `{ tick }` drops the block that is moving, on that tick (not the tick it appeared on, and never after the longest a run
// may last); `end` `{ tick }` closes the run (a run that is not closed counts as it stands). A drop that misses the tower ends the run.

function drop(state: TowerState, data: RunInput["data"]): Stepped<TowerState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    if (typeof tick === "string") return refuse(tick);
    if (tick <= state.startTick)
      return refuse("a block cannot be dropped on the tick it appears");
    return { ok: true, state: dropAt(state, tick) };
  });
}

function finish(
  state: TowerState,
  data: RunInput["data"],
): Stepped<TowerState> {
  return withFields(data, ["tick"], (fields) => {
    const tick = tickNamed(fields.tick, state.tick, maxTicks);
    return typeof tick === "string"
      ? refuse(tick)
      : { ok: true, state: { ...state, ended: true, tick } };
  });
}

export const towerRules: GameVerifier<TowerState> = {
  earned: earnedBy,
  id: verifierId,
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startTower(seed) };
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    if (state.over && input.type !== "end")
      return refuse("the tower has fallen");
    switch (input.type) {
      case "drop":
        return drop(state, input.data);
      case "end":
        return finish(state, input.data);
      default:
        return refuse(`no such input: ${input.type}`);
    }
  },
  version: verifierVersion,
};
