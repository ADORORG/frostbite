import { rules, type RunState } from "../../src/rules/index.ts";

// A run begun on `seed`, and a step the test expects the rules to take.
export const start = (seed = 7): RunState => {
  const begun = rules.init(seed, {});
  if (!begun.ok) throw new Error(begun.reason);
  return begun.state;
};

export const step = (
  state: RunState,
  type: string,
  data: number | number[],
): RunState => {
  const next = rules.step(state, { data, type });
  if (!next.ok) throw new Error(next.reason);
  return next.state;
};
