import { describe, expect, it } from "vitest";

import { earnedBy, milestoneIds } from "../src/rules/milestones.ts";
import { startDrop, type DropState } from "../src/rules/state.ts";

const base = startDrop(1);
const state = (over: Partial<DropState>): DropState => ({ ...base, ...over });
const has = (over: Partial<DropState>, id: string): boolean =>
  earnedBy(state(over)).includes(id);
// A run in which `level` was first reached on the given move.
const reached = (level: number, move = 50): readonly number[] =>
  Array.from({ length: 16 }, (_, at) => (at > 0 && at <= level ? move : 0));

const tiles: readonly (readonly [string, number])[] = [
  ["tile-64", 6],
  ["tile-128", 7],
  ["tile-256", 8],
  ["tile-512", 9],
  ["tile-1024", 10],
  ["tile-2048", 11],
  ["tile-4096", 12],
];
const counters: readonly (readonly [
  string,
  (n: number) => Partial<DropState>,
  number,
])[] = [
  ["score-1k", (n) => ({ score: n }), 1_000],
  ["score-2500", (n) => ({ score: n }), 2_500],
  ["score-5k", (n) => ({ score: n }), 5_000],
  ["score-10k", (n) => ({ score: n }), 10_000],
  ["score-25k", (n) => ({ score: n }), 25_000],
  ["moves-100", (n) => ({ moves: n }), 100],
  ["moves-250", (n) => ({ moves: n }), 250],
  ["moves-500", (n) => ({ moves: n }), 500],
  ["moves-1000", (n) => ({ moves: n }), 1_000],
  ["double-up", (n) => ({ mostMerges: n }), 2],
  ["four-at-once", (n) => ({ mostMerges: n }), 4],
  ["avalanche", (n) => ({ mostMerges: n }), 6],
  ["on-a-roll", (n) => ({ bestStreak: n }), 5],
  ["hot-streak", (n) => ({ bestStreak: n }), 10],
  ["unbreakable", (n) => ({ bestStreak: n }), 20],
];

describe("every milestone", () => {
  it("is in a table here once, and the table has nothing else", () => {
    const covered = [
      ...tiles.map(([id]) => id),
      ...counters.map(([id]) => id),
      "corner-king",
      "spacious",
      "close-shave",
      "quick-128",
    ].sort();
    expect([...milestoneIds].sort()).toEqual(covered);
    expect(new Set(milestoneIds).size).toBe(milestoneIds.length);
    expect(milestoneIds).toHaveLength(26);
  });

  it.each(tiles)(
    "%s: earned once the level is reached, and not by the level below",
    (id, level) => {
      expect(has({ reachedAt: reached(level - 1) }, id)).toBe(false);
      expect(has({ reachedAt: reached(level) }, id)).toBe(true);
      expect(has({ reachedAt: reached(level + 2) }, id)).toBe(true);
    },
  );

  it.each(counters)(
    "%s: not one short of its goal, and earned at it",
    (id, make, goal) => {
      expect(has(make(goal - 1), id)).toBe(false);
      expect(has(make(goal), id)).toBe(true);
      expect(has(make(goal + 100), id)).toBe(true);
    },
  );

  it("corner-king, spacious and close-shave are earned by their marks", () => {
    expect(has({}, "corner-king")).toBe(false);
    expect(has({ cornerKing: true }, "corner-king")).toBe(true);
    expect(has({}, "spacious")).toBe(false);
    expect(has({ spacious: true }, "spacious")).toBe(true);
    expect(has({}, "close-shave")).toBe(false);
    expect(has({ closeShave: true }, "close-shave")).toBe(true);
  });

  it("quick-128 takes a 128 within the first hundred moves, and not one that came later", () => {
    expect(has({ reachedAt: reached(7, 100) }, "quick-128")).toBe(true);
    expect(has({ reachedAt: reached(7, 101) }, "quick-128")).toBe(false);
    expect(has({ reachedAt: reached(6, 20) }, "quick-128")).toBe(false);
  });

  it("a fresh run earns none of them", () => {
    expect(earnedBy(base)).toEqual([]);
  });
});
