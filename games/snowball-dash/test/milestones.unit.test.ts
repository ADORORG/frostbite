import { describe, expect, it } from "vitest";

import {
  baseSpeed,
  speedStepUnits,
  topSpeedBonus,
} from "../src/rules/constants.ts";
import { earnedBy, metres, milestoneIds } from "../src/rules/milestones.ts";
import type { SnowballState } from "../src/rules/types.ts";
import { withRocks } from "./support/states.ts";

const has = (over: Partial<SnowballState>, id: string): boolean =>
  earnedBy(withRocks([], over)).includes(id);

// Each milestone, with the least that earns it: just below does not, and exactly at it does.
const table: readonly (readonly [
  string,
  (n: number) => Partial<SnowballState>,
  number,
])[] = [
  ["first-hop", (n) => ({ hops: n }), 1],
  ["rock-hopper", (n) => ({ cleared: n }), 5],
  ["rock-master", (n) => ({ cleared: n }), 15],
  ["hundred-metres", (n) => ({ distance: n }), 1_000],
  ["three-hundred-metres", (n) => ({ distance: n }), 3_000],
  ["close-shave", (n) => ({ closeCalls: n }), 1],
  ["daredevil", (n) => ({ closeCalls: n }), 5],
  ["full-speed", (n) => ({ distance: n }), speedStepUnits * topSpeedBonus],
];

describe("every milestone", () => {
  it.each(table)(
    "%s is earned at its threshold and not below",
    (id, make, at) => {
      expect(has(make(at - 1), id)).toBe(false);
      expect(has(make(at), id)).toBe(true);
      expect(has(make(at + 1), id)).toBe(true);
    },
  );

  it("reaching the foot needs the run to have finished", () => {
    expect(has({ finished: false, hops: 0 }, "foot-of-the-slope")).toBe(false);
    expect(has({ finished: true }, "foot-of-the-slope")).toBe(true);
  });

  it("a tidy run needs the foot reached with no more hops than rocks", () => {
    const rocks = [1, 2, 3];
    const tidy = (finished: boolean, hops: number) =>
      earnedBy(withRocks(rocks, { finished, hops })).includes("tidy-run");
    expect(tidy(true, 3)).toBe(true);
    expect(tidy(true, 4)).toBe(false);
    expect(tidy(false, 3)).toBe(false);
  });

  it("has ten, each with its own id, and a fresh run has none", () => {
    expect(milestoneIds).toHaveLength(10);
    expect(new Set(milestoneIds).size).toBe(10);
    expect(earnedBy(withRocks([]))).toEqual([]);
  });

  it("counts whole metres, ten units to a metre", () => {
    expect(metres(withRocks([], { distance: 99 }))).toBe(9);
    expect(metres(withRocks([], { distance: 100 }))).toBe(10);
    expect(baseSpeed).toBeGreaterThan(0);
  });
});
