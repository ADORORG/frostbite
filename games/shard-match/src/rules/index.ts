import { fieldsOf, refuse } from "@frostbite/game-sdk/run-inputs";
import type { GameVerifier, RunInput } from "@frostbite/game-sdk/run-record";

import { cells, verifierId, verifierVersion } from "./constants.ts";
import { earnedBy } from "./milestones.ts";
import { startRun, type MatchState } from "./state.ts";
import { swapOnce } from "./swap.ts";

// SHARD MATCH's rules, as a pure state machine: the same seed and swaps always play out the same way, which is what lets the platform replay a
// run it issued a seed for. A run is a list of inputs; `swap` `{ cell, to }` swaps the shard in `cell` (0 to 63, row by row) with its
// neighbour `to` (0 up, 1 right, 2 down, 3 left) and must make a line; `end` closes the run (a run that is not closed is counted as it stands).
export const matchRules: GameVerifier<MatchState> = {
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
    if (input.type === "end") {
      if (input.data !== undefined) return refuse("end takes no data");
      return { ok: true, state: { ...state, ended: true } };
    }
    if (input.type !== "swap") return refuse(`no such input: ${input.type}`);
    const fields = fieldsOf(input.data, ["cell", "to"]);
    if (typeof fields === "string") return refuse(fields);
    const { cell, to } = fields;
    if (
      typeof cell !== "number" ||
      !Number.isInteger(cell) ||
      cell < 0 ||
      cell >= cells
    )
      return refuse("cell must be a whole number on the board");
    if (typeof to !== "number" || !Number.isInteger(to) || to < 0 || to > 3)
      return refuse("to must be 0, 1, 2 or 3");
    const next = swapOnce(state, cell, to);
    return typeof next === "string" ? refuse(next) : { ok: true, state: next };
  },
  version: verifierVersion,
};
