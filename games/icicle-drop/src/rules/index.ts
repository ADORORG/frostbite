import { fieldsOf, refuse } from "@ador/game-sdk/run-inputs";
import type { GameVerifier, RunInput } from "@ador/game-sdk/run-record";

import { directions, verifierId, verifierVersion } from "./constants.ts";
import { earnedBy } from "./milestones.ts";
import { moveOnce } from "./move.ts";
import { startDrop, type DropState } from "./state.ts";

// ICICLE DROP's rules, as a pure state machine: the same seed and moves always play out the same way, which is what lets the platform
// replay a run it issued a seed for. A run is a list of moves; each is `left`, `right`, `up` or `down` with no data, and `end` closes the
// run (a run that is not closed is counted as it stands). A move that changes nothing is refused, as the game refuses it.
export const dropRules: GameVerifier<DropState> = {
  earned: earnedBy,
  id: verifierId,
  init(seed, config) {
    const fields = fieldsOf(config, []);
    return typeof fields === "string"
      ? refuse(`no such setting: ${Object.keys(config)[0] ?? ""}`)
      : { ok: true, state: startDrop(seed) };
  },
  step(state, input: RunInput) {
    if (state.ended) return refuse("the run has ended");
    if (state.over && input.type !== "end") return refuse("no move is left");
    if (input.data !== undefined) return refuse("a move takes no data");
    if (input.type === "end")
      return { ok: true, state: { ...state, ended: true } };
    const direction = directions.find((candidate) => candidate === input.type);
    if (direction === undefined) return refuse(`no such input: ${input.type}`);
    const next = moveOnce(state, direction);
    return next === null
      ? refuse("that move changes nothing")
      : { ok: true, state: next };
  },
  version: verifierVersion,
};
