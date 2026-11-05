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

  it("are none at the start, and the first swap after one swap", () => {
    expect(earnedBy(startRun(1))).toEqual([]);
    expect(earnedBy(withCounts({ swaps: 1 }))).toEqual(["first-swap"]);
  });

  it("each come at exactly their number, and not one short", () => {
    const counts: Record<
      string,
      (n: number) => Parameters<typeof withCounts>[0]
    > = {
      score: (n) => ({ score: n }),
      levels: (n) => ({ levelsCleared: n }),
      frost: (n) => ({ frostBroken: n }),
      chain: (n) => ({ bestChain: n }),
      line: (n) => ({ bestLine: n }),
      bombs: (n) => ({ bombsMade: n }),
      stars: (n) => ({ starsMade: n }),
      blasts: (n) => ({ bombsFired: n }),
      shards: (n) => ({ cleared: n }),
      swap: (n) => ({ bestSwap: n }),
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
