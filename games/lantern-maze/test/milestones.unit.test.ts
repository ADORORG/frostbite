import { describe, expect, it } from "vitest";

import {
  earnedBy,
  idOf,
  ladders,
  milestoneIds,
} from "../src/rules/milestones.ts";
import { startRun } from "../src/rules/state.ts";
import { withCounts } from "./support/states.ts";

describe("the milestones", () => {
  it("are forty, each named once", () => {
    expect(milestoneIds).toHaveLength(40);
    expect(new Set(milestoneIds).size).toBe(40);
  });

  it("are none at the start, and the first step after one step", () => {
    expect(earnedBy(startRun(1))).toEqual([]);
    expect(earnedBy(withCounts({ moves: 1 }))).toEqual(["first-step"]);
  });

  it("each come at exactly their number, and not one short", () => {
    const counts: Record<
      string,
      (n: number) => Parameters<typeof withCounts>[0]
    > = {
      floors: (n) => ({ floorsCleared: n }),
      flasks: (n) => ({ flasksTaken: n }),
      lean: (n) => ({ lean: n }),
      flawless: (n) => ({ flawless: n }),
      sweep: (n) => ({ fullFloors: n }),
      streak: (n) => ({ bestLeanStreak: n }),
      oil: (n) => ({ peakOil: n }),
      steps: (n) => ({ moves: n }),
      score: (n) => ({ score: n }),
    };
    expect(Object.keys(counts).sort()).toEqual(
      ladders.map(({ prefix }) => prefix).sort(),
    );
    for (const { prefix, steps } of ladders)
      for (const step of steps) {
        const make = counts[prefix];
        if (make === undefined) throw new Error(prefix);
        const id = idOf(prefix, step);
        expect(earnedBy(withCounts(make(step)))).toContain(id);
        expect(earnedBy(withCounts(make(step - 1)))).not.toContain(id);
      }
  });

  it("keep each ladder in order, so a higher rung always needs more", () => {
    for (const { steps } of ladders)
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});
