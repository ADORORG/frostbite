import { describe, expect, it } from "vitest";

import { earnedBy, milestoneIds, milestones } from "../src/rules/milestones.ts";
import { startRun } from "../src/rules/state.ts";

const scored = (score: number) => ({ ...startRun(1), score });

describe("the milestones", () => {
  it("are earned at their own score and not one catch before, and stay earned above it", () => {
    for (const { id, score } of milestones) {
      expect(earnedBy(scored(score - 1))).not.toContain(id);
      expect(earnedBy(scored(score))).toContain(id);
      expect(earnedBy(scored(score + 10))).toContain(id);
    }
    expect(earnedBy(scored(0))).toEqual([]);
  });

  it("have each an id of its own", () => {
    expect(new Set(milestoneIds).size).toBe(milestones.length);
  });
});
