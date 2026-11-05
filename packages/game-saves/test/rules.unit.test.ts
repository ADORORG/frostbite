import type { GameState } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { boundState, earnReached, type MilestoneRules } from "../src/rules.ts";

const now = new Date("2026-10-13T12:00:00.000Z");
const rules: MilestoneRules = new Map([
  ["goal", { claimPolicy: "once", target: 10 }],
  ["plain", { claimPolicy: "once" }],
  ["again", { claimPolicy: "repeatable", maxCount: 3 }],
  // A repeatable milestone with no maximum: the manifest refuses it, so this is only what a hand-built rule does.
  ["unbounded", { claimPolicy: "repeatable" }],
]);
const record = (id: string, count: number) => ({
  count,
  id,
  unlockedAt: "2026-10-01T00:00:00.000Z",
  verification: "self-reported" as const,
});
const state = (overrides: Partial<GameState>): GameState => ({
  counters: [],
  milestones: [],
  progress: null,
  ...overrides,
});

describe("bounding a state to the manifest's rules", () => {
  it("cuts a count to the maximum, to one for a milestone earned once, and to one when a repeatable one has no maximum", () => {
    const bounded = boundState(
      state({
        milestones: [
          record("again", 50),
          record("plain", 50),
          record("unbounded", 50),
          record("goal", 2),
        ],
      }),
      rules,
    );
    expect(bounded.milestones.map(({ count, id }) => [id, count])).toEqual([
      ["again", 3],
      ["plain", 1],
      ["unbounded", 1],
      ["goal", 1],
    ]);
  });

  it("cuts a total to its target and leaves a total with no target alone", () => {
    const bounded = boundState(
      state({
        counters: [
          { current: 99, id: "goal" },
          { current: 5, id: "plain" },
        ],
      }),
      rules,
    );
    expect(bounded.counters).toEqual([
      { current: 10, id: "goal" },
      { current: 5, id: "plain" },
    ]);
  });

  it("leaves what the rules do not know alone, for the caller to have refused", () => {
    const input = state({
      counters: [{ current: 99, id: "stranger" }],
      milestones: [record("stranger", 99)],
    });
    expect(boundState(input, rules)).toEqual(input);
  });
});

describe("earning a milestone whose total has reached its target", () => {
  it("earns it, at the given time, once, in id order, and leaves totals below the target", () => {
    const earned = earnReached(
      state({
        counters: [
          { current: 10, id: "goal" },
          { current: 4, id: "stranger" },
        ],
        milestones: [record("again", 1)],
      }),
      rules,
      now,
    );
    expect(earned.milestones).toEqual([
      record("again", 1),
      {
        count: 1,
        id: "goal",
        unlockedAt: now.toISOString(),
        verification: "self-reported",
      },
    ]);
    expect(earnReached(earned, rules, new Date("2030-01-01"))).toEqual(earned);
  });

  it("returns the very same state when nothing was reached", () => {
    const input = state({ counters: [{ current: 9, id: "goal" }] });
    expect(earnReached(input, rules, now)).toBe(input);
  });
});
