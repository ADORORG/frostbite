import { describe, expect, it } from "vitest";

import {
  exposeReplay,
  metaGlobal,
  replayFromText,
  replayGlobal,
  replayRecord,
  sampleGlobal,
} from "../src/replay.ts";
import type { GameVerifier, RunRecord } from "../src/run-record.ts";

// A tiny rule set: add 1 to 3 until the count reaches the target; earns "reached" at or past it, "exact" on it.
interface Counter {
  readonly count: number;
  readonly target: number;
}
const rules: GameVerifier<Counter> = {
  earned: ({ count, target }) =>
    count >= target
      ? count === target
        ? ["reached", "exact", "reached"]
        : ["reached"]
      : [],
  id: "counter",
  // The run has ended once the count reaches the target, and scores that count.
  score: ({ count, target }) => (count >= target ? count : null),
  init: (seed, config) => {
    const { target } = config;
    if (typeof target !== "number" || target < 1)
      return { ok: false, reason: "target must be at least 1" };
    return { ok: true, state: { count: seed % 2, target } };
  },
  step: (state, input) =>
    input.type === "add" &&
    typeof input.data === "number" &&
    input.data >= 1 &&
    input.data <= 3
      ? { ok: true, state: { ...state, count: state.count + input.data } }
      : { ok: false, reason: "add takes 1, 2 or 3" },
  version: 3,
};
const record = (over: Partial<RunRecord> = {}): RunRecord => ({
  claims: [],
  config: { target: 5 },
  gameId: "counting",
  inputs: [
    { data: 3, type: "add" },
    { data: 2, type: "add" },
  ],
  schemaVersion: 1,
  seed: 0,
  verifier: "counter",
  verifierVersion: 3,
  ...over,
});

describe("replaying a record with a game's rules", () => {
  it("gives what the run earned, once each, from the seed and the settings", () => {
    expect(replayRecord(rules, record())).toEqual({
      earned: ["reached", "exact"],
      ok: true,
      score: 5,
    });
    // Seed 1 starts the count at 1, so 3 + 2 overshoots the target: reached, not exact.
    expect(replayRecord(rules, record({ seed: 1 }))).toEqual({
      earned: ["reached"],
      ok: true,
      score: 6,
    });
    expect(
      replayRecord(rules, record({ inputs: [{ data: 1, type: "add" }] })),
    ).toEqual({
      earned: [],
      ok: true,
      score: null,
    });
  });

  it("refuses settings the rules do not allow, and the first input they do not accept, saying which", () => {
    expect(replayRecord(rules, record({ config: { target: 0 } }))).toEqual({
      detail: "target must be at least 1",
      index: null,
      ok: false,
      reason: "invalid-config",
    });
    expect(
      replayRecord(
        rules,
        record({
          inputs: [
            { data: 1, type: "add" },
            { data: 9, type: "add" },
          ],
        }),
      ),
    ).toEqual({
      detail: "add takes 1, 2 or 3",
      index: 1,
      ok: false,
      reason: "illegal-input",
    });
  });

  it("answers a failure inside the rules as that, never as an exception", () => {
    const broken: GameVerifier<number> = {
      earned: () => [],
      id: "broken",
      init: () => ({ ok: true, state: 0 }),
      step: () => {
        throw new Error("a bug");
      },
      version: 1,
    };
    expect(replayRecord(broken, record())).toEqual({
      detail: "The verifier failed while replaying this run.",
      index: null,
      ok: false,
      reason: "verifier-error",
    });
  });
});

describe("replaying from text", () => {
  it("takes a record as text and answers an outcome as text", () => {
    expect(JSON.parse(replayFromText(rules, JSON.stringify(record())))).toEqual(
      {
        earned: ["reached", "exact"],
        ok: true,
        score: 5,
      },
    );
  });

  it("answers text that is not JSON, and JSON that is not a record, as a failure and not an exception", () => {
    for (const text of [
      "not json",
      "",
      "{",
      "null",
      "[]",
      "{}",
      '{"inputs":3}',
      "5",
    ])
      expect(JSON.parse(replayFromText(rules, text))).toMatchObject({
        ok: false,
        reason: "verifier-error",
      });
  });
});

describe("publishing the rules as an artifact", () => {
  it("leaves a replay function, a sample and the rules' identity in the global scope, and nothing the runner needs besides", () => {
    exposeReplay(rules, record());
    const published = globalThis as unknown as Record<string, unknown>;
    try {
      const replay = published[replayGlobal];
      expect(typeof replay).toBe("function");
      expect(JSON.parse(published[sampleGlobal] as string)).toEqual(record());
      expect(JSON.parse(published[metaGlobal] as string)).toEqual({
        id: "counter",
        version: 3,
      });
      expect(
        JSON.parse(
          (replay as (text: string) => string)(JSON.stringify(record())),
        ),
      ).toEqual({
        earned: ["reached", "exact"],
        ok: true,
        score: 5,
      });
    } finally {
      for (const name of [replayGlobal, sampleGlobal, metaGlobal])
        Reflect.deleteProperty(globalThis, name);
    }
  });
});
