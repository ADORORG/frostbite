import { startRun, type PulseState } from "../../src/rules/state.ts";

// A state of a run with some of its numbers set, for the tests of what they decide.
export const withCounts = (
  counts: Partial<PulseState>,
  seed = 1,
): PulseState => ({
  ...startRun(seed),
  ...counts,
});
