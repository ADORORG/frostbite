import { fieldsOf, refuse } from "@ador/game-sdk/run-inputs";
import type { GameVerifier, RunInput } from "@ador/game-sdk/run-record";

import { directions, verifierId, verifierVersion } from "./constants.ts";
import { earnedBy } from "./milestones.ts";
import { stepOnce } from "./move.ts";
import { startRun, type MazeState } from "./state.ts";

// LANTERN MAZE's rules, as a pure state machine: the same seed and steps always play out the same way, which is what lets the platform
// replay a run it issued a seed for. A run is a list of steps; each is `up`, `right`, `down` or `left` with no data, and `end` closes the
// run (a run that is not closed is counted as it stands). A step into a wall is refused, as the game refuses it.
export const mazeRules: GameVerifier<MazeState> = {
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
    if (input.data !== undefined) return refuse("a step takes no data");
    if (input.type === "end")
      return { ok: true, state: { ...state, ended: true } };
    const direction = directions.findIndex((name) => name === input.type);
    if (direction < 0) return refuse(`no such input: ${input.type}`);
    const next = stepOnce(state, direction);
    return typeof next === "string" ? refuse(next) : { ok: true, state: next };
  },
  version: verifierVersion,
};
