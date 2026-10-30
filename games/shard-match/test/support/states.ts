import { startRun, type MatchState } from "../../src/rules/state.ts";

// A state of a run with some of its numbers set, for the tests of what they decide.
export const withCounts = (
  counts: Partial<MatchState>,
  seed = 1,
): MatchState => ({
  ...startRun(seed),
  ...counts,
});
