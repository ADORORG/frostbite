import { startRun, type MazeState } from "../../src/rules/state.ts";

// A state of a run with some of its numbers set, for the tests of what they decide.
export const withCounts = (
  counts: Partial<MazeState>,
  seed = 1,
): MazeState => ({
  ...startRun(seed),
  ...counts,
});
