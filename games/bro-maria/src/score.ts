import { maxTicks } from "./rules/constants.ts";
import { coinsTaken } from "./rules/milestones.ts";
import type { State } from "./rules/types.ts";

// What a run is worth, for the page to show and to keep as the best: a coin is 100, a stomp 200, a crate 50, a stage cleared 1,000, and the
// last stage cleared adds a bonus for the time left. The rules do not use it (the marks are decided by the counts); it is the player's own note.
export const scoreOf = (state: State): number =>
  coinsTaken(state) * 100 +
  state.stomps * 200 +
  state.crates * 50 +
  state.stagesCleared * 1_000 +
  (state.finishTick === null
    ? 0
    : Math.floor((maxTicks - state.finishTick) / 4));
