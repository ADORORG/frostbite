import { describe, expect, it } from "vitest";

import { clearPoints } from "../src/rules/scoring.ts";

const base = {
  backToBack: false,
  cleared: 0,
  combo: -1,
  emptied: false,
  level: 1,
};

describe("what a clear is worth", () => {
  it("is a hundred, three, five and eight hundred for one to four rows, times the level", () => {
    expect(
      [1, 2, 3, 4].map((cleared) => clearPoints({ ...base, cleared })),
    ).toEqual([100, 300, 500, 800]);
    expect(clearPoints({ ...base, cleared: 4, level: 7 })).toBe(5_600);
  });

  it("is nothing for no rows, whatever else is true", () => {
    expect(
      clearPoints({
        backToBack: true,
        cleared: 0,
        combo: 5,
        emptied: true,
        level: 9,
      }),
    ).toBe(0);
  });

  it("adds fifty a step of the combo times the level, from the second clear in a row", () => {
    expect(clearPoints({ ...base, cleared: 1, combo: 0 })).toBe(100);
    expect(clearPoints({ ...base, cleared: 1, combo: 3, level: 2 })).toBe(
      200 + 50 * 3 * 2,
    );
  });

  it("is three halves for a four after a four, and only for a four", () => {
    expect(clearPoints({ ...base, backToBack: true, cleared: 4 })).toBe(1_200);
    expect(clearPoints({ ...base, backToBack: true, cleared: 3 })).toBe(500);
    expect(clearPoints({ ...base, backToBack: false, cleared: 4 })).toBe(800);
  });

  it("adds two thousand times the level for leaving the board empty", () => {
    expect(clearPoints({ ...base, cleared: 1, emptied: true, level: 3 })).toBe(
      300 + 6_000,
    );
  });
});
