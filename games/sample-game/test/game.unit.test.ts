import { describe, expect, it } from "vitest";

import {
  earned,
  milestoneThresholds,
  restore,
  startState,
  tap,
} from "../src/game.ts";

describe("the rules of Tap Tower", () => {
  it("scores one for each tap", () => {
    expect(tap(tap(startState))).toEqual({ score: 2 });
  });

  it.each([
    ["nothing saved", null],
    ["text", "score"],
    ["no score", {}],
    ["a score that is not a number", { score: "4" }],
    ["a fraction", { score: 1.5 }],
    ["a negative score", { score: -1 }],
  ])("starts afresh from %s", (_why, saved) => {
    expect(restore(saved)).toEqual(startState);
  });

  it("carries on from a saved score", () => {
    expect(restore({ score: 7 })).toEqual({ score: 7 });
  });

  it("earns each milestone at its score, and keeps it after", () => {
    expect(earned({ score: 4 })).toEqual([]);
    expect(earned({ score: 5 })).toEqual(["first-five"]);
    expect(earned({ score: 12 })).toEqual(["first-five", "ten-taps"]);
    expect(milestoneThresholds.map(({ id }) => id)).toEqual([
      "first-five",
      "ten-taps",
    ]);
  });
});
