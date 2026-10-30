import { describe, expect, it } from "vitest";

import { leadTicks, stageTicks } from "../src/rules/constants.ts";
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

  it("are none at the start, and the first hit after one hit", () => {
    expect(earnedBy(startRun(1))).toEqual([]);
    expect(earnedBy(withCounts({ hits: 1 }))).toEqual(["first-hit"]);
  });

  it("each come at exactly their number, and not one short", () => {
    const counts: Record<
      string,
      (n: number) => Parameters<typeof withCounts>[0]
    > = {
      score: (n) => ({ score: n }),
      combo: (n) => ({ bestCombo: n }),
      perfects: (n) => ({ perfects: n }),
      stage: (n) => ({ tick: leadTicks + (n - 1) * stageTicks }),
      hits: (n) => ({ hits: n }),
      clean: (n) => ({ cleanBars: n }),
      streak: (n) => ({ bestPerfects: n }),
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
        const short =
          prefix === "stage"
            ? { tick: leadTicks + (step - 1) * stageTicks - 1 }
            : make(step - 1);
        expect(earnedBy(withCounts(short))).not.toContain(id);
      }
  });

  it("include the light at its fullest, and the whole track played out, and nothing short of them", () => {
    expect(earnedBy(withCounts({ peakEnergy: 100 }))).toContain("full-light");
    expect(earnedBy(withCounts({ peakEnergy: 99 }))).not.toContain(
      "full-light",
    );
    expect(earnedBy(withCounts({ cause: "finished" }))).toContain("full-set");
    for (const cause of ["faded", "spent", null] as const)
      expect(earnedBy(withCounts({ cause }))).not.toContain("full-set");
  });

  it("keep each ladder in order, so a higher rung always needs more", () => {
    for (const { steps } of ladders)
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
  });
});
