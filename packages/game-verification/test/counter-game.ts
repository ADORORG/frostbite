import type { RunRecord } from "@ador/game-sdk/run-record";

import type { GameVerifier } from "../src/verifier.ts";

// A tiny deterministic game for the tests: add 1 to 3 to a counter until it reaches a target, then stop. It earns
// "reached" when the counter is at or past the target, and "exact" when it landed on it exactly.
interface Counter {
  readonly count: number;
  readonly stopped: boolean;
  readonly target: number;
}

export const counterRules: GameVerifier<Counter> = {
  earned: ({ count, target }) =>
    count >= target
      ? count === target
        ? ["reached", "exact"]
        : ["reached"]
      : [],
  id: "counter",
  init: (seed, config) => {
    const { target } = config;
    if (
      typeof target !== "number" ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 100
    )
      return {
        ok: false,
        reason: "target must be a whole number from 1 to 100",
      };
    return { ok: true, state: { count: seed % 2, stopped: false, target } };
  },
  step: (state, input) => {
    if (state.stopped) return { ok: false, reason: "the run has stopped" };
    if (input.type === "stop")
      return { ok: true, state: { ...state, stopped: true } };
    if (input.type !== "add")
      return { ok: false, reason: `no such input: ${input.type}` };
    const { data } = input;
    if (
      typeof data !== "number" ||
      !Number.isInteger(data) ||
      data < 1 ||
      data > 3
    )
      return { ok: false, reason: "add takes 1, 2 or 3" };
    return { ok: true, state: { ...state, count: state.count + data } };
  },
  version: 1,
};

export const crashingRules: GameVerifier<number> = {
  earned: () => [],
  id: "crashing",
  init: () => ({ ok: true, state: 0 }),
  step: () => {
    throw new Error("a bug in the game's rules");
  },
  version: 1,
};

export const counterSample: RunRecord = {
  claims: ["reached"],
  config: { target: 5 },
  gameId: "counting",
  inputs: [
    { data: 3, type: "add" },
    { data: 2, type: "add" },
  ],
  schemaVersion: 1,
  seed: 0,
  verifier: "counter",
  verifierVersion: 1,
};

export const crashingSample: RunRecord = {
  ...counterSample,
  claims: [],
  gameId: "crashy",
  verifier: "crashing",
};
