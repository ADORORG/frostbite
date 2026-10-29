import { describe, expect, it } from "vitest";

import {
  baseSpeed,
  speedStepUnits,
  topSpeedBonus,
} from "../src/rules/constants.ts";
import { earnedBy, metres, milestoneIds } from "../src/rules/milestones.ts";
import type { RunnerState } from "../src/rules/types.ts";
import { empty } from "./support/states.ts";

const base = empty();
const state = (over: Partial<RunnerState>): RunnerState => ({
  ...base,
  ...over,
});
const has = (over: Partial<RunnerState>, id: string): boolean =>
  earnedBy(state(over)).includes(id);

// Each milestone, with the least that earns it: just below does not, and exactly at it does.
const table: readonly (readonly [
  string,
  (n: number) => Partial<RunnerState>,
  number,
])[] = [
  ["first-steps", (n) => ({ distance: n * 10 }), 100],
  ["quarter-km", (n) => ({ distance: n * 10 }), 250],
  ["half-km", (n) => ({ distance: n * 10 }), 500],
  ["one-km", (n) => ({ distance: n * 10 }), 1_000],
  ["two-km", (n) => ({ distance: n * 10 }), 2_000],
  ["three-km", (n) => ({ distance: n * 10 }), 3_000],
  ["shard-10", (n) => ({ shardsTaken: n }), 10],
  ["shard-50", (n) => ({ shardsTaken: n }), 50],
  ["shard-100", (n) => ({ shardsTaken: n }), 100],
  ["shard-250", (n) => ({ shardsTaken: n }), 250],
  ["sky-picker", (n) => ({ highShards: n }), 10],
  ["hurdler", (n) => ({ cleared: n }), 10],
  ["steeplechase", (n) => ({ cleared: n }), 50],
  ["obstacle-course", (n) => ({ cleared: n }), 100],
  ["unstoppable", (n) => ({ cleared: n }), 200],
  ["close-call", (n) => ({ closeCalls: n }), 1],
  ["daredevil", (n) => ({ closeCalls: n }), 10],
  ["thread-the-needle", (n) => ({ closeCalls: n }), 25],
  ["leap-of-faith", (n) => ({ jumps: n }), 25],
  ["limbo", (n) => ({ slides: n }), 25],
  ["minute-man", (n) => ({ tick: n }), 1_800],
  ["blizzard-pace", (n) => ({ distance: n }), speedStepUnits * topSpeedBonus],
];

describe("every milestone", () => {
  it("is in the table, once, and the table has nothing else", () => {
    const covered = [...table.map(([id]) => id), "acrobat"].sort();
    expect([...milestoneIds].sort()).toEqual(covered);
    expect(new Set(milestoneIds).size).toBe(milestoneIds.length);
    expect(milestoneIds).toHaveLength(23);
  });

  it.each(table)(
    "%s: not one short of its goal, and earned at it",
    (id, make, goal) => {
      expect(has(make(goal - 1), id)).toBe(false);
      expect(has(make(goal), id)).toBe(true);
      expect(has(make(goal * 2), id)).toBe(true);
    },
  );

  it("acrobat takes forty jumps and forty slides, both", () => {
    expect(has({ jumps: 40, slides: 39 }, "acrobat")).toBe(false);
    expect(has({ jumps: 39, slides: 40 }, "acrobat")).toBe(false);
    expect(has({ jumps: 40, slides: 40 }, "acrobat")).toBe(true);
  });

  it("a fresh run earns none of them", () => {
    expect(earnedBy(base)).toEqual([]);
  });
});

describe("distance in metres", () => {
  it("is ten units to a metre, rounded down", () => {
    expect(metres(state({ distance: 99 }))).toBe(9);
    expect(metres(state({ distance: 100 }))).toBe(10);
    expect(baseSpeed).toBe(3);
  });
});
