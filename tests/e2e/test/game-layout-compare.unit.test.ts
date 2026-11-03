import { describe, expect, it } from "vitest";

import {
  layoutDifferences,
  layoutTolerancePx,
  parseSavedLayouts,
} from "../src/game-layout-compare.ts";
import type { Box } from "../src/game-layout.ts";

const bar: Box = { h: 33, name: "div.bar", w: 1256, x: 12, y: 8 };
const status: Box = { h: 19, name: "p#status", w: 894, x: 221, y: 15 };
const saved = { "game@1280x800": [bar, status] };

describe("layoutDifferences", () => {
  it("accepts the same layout", () => {
    expect(layoutDifferences(saved, saved)).toEqual([]);
  });

  it("accepts the differences of a font: 5px of height, 41px of width, 26px of place", () => {
    const found = {
      "game@1280x800": [
        { ...bar, h: 28 },
        { ...status, w: 853, x: 247, y: 14 },
      ],
    };
    expect(layoutDifferences(found, saved)).toEqual([]);
  });

  it("accepts a part exactly at the tolerance and refuses one pixel more", () => {
    const at = {
      "game@1280x800": [{ ...bar, y: bar.y + layoutTolerancePx }, status],
    };
    expect(layoutDifferences(at, saved)).toEqual([]);
    const over = {
      "game@1280x800": [{ ...bar, y: bar.y + layoutTolerancePx + 1 }, status],
    };
    expect(layoutDifferences(over, saved)).toEqual([
      "game@1280x800: div.bar y is 69, saved 8 (61px, more than 60px)",
    ]);
  });

  it("refuses a part that moved, in either direction, on any side", () => {
    for (const side of ["x", "y", "w", "h"] as const)
      for (const sign of [1, -1]) {
        const moved = {
          "game@1280x800": [
            bar,
            { ...status, [side]: status[side] + sign * 100 },
          ],
        };
        const problems = layoutDifferences(moved, saved);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain(`p#status ${side} is`);
      }
  });

  it("refuses a part that was added, removed, renamed or re-ordered", () => {
    const extra = { "game@1280x800": [bar, status, bar] };
    const fewer = { "game@1280x800": [bar] };
    const renamed = { "game@1280x800": [bar, { ...status, name: "p#note" }] };
    const swapped = { "game@1280x800": [status, bar] };
    for (const found of [extra, fewer, renamed, swapped])
      expect(layoutDifferences(found, saved)).toEqual([
        expect.stringContaining("the named parts changed"),
      ]);
  });

  it("refuses a game or size that is no longer measured, or that has no saved layout", () => {
    expect(layoutDifferences({}, saved)).toEqual([
      "game@1280x800: no longer measured",
    ]);
    expect(layoutDifferences(saved, {})).toEqual([
      "game@1280x800: not in the saved layouts",
    ]);
  });
});

describe("parseSavedLayouts", () => {
  it("reads a file of boxes", () => {
    expect(parseSavedLayouts(JSON.stringify(saved))).toEqual(saved);
  });

  it("refuses a file that is not an object of lists of boxes", () => {
    for (const text of [
      "[]",
      "null",
      '"text"',
      '{"a": 1}',
      '{"a": [{"name": "x"}]}',
      '{"a": [{"name": "x", "x": 1, "y": 1, "w": 1, "h": "1"}]}',
      '{"a": [null]}',
    ])
      expect(() => parseSavedLayouts(text), text).toThrow();
  });
});
