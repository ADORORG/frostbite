import { describe, expect, it } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { colour } from "../src/screen/palette.ts";
import { resultOf } from "../src/screen/result.ts";
import type { View } from "../src/screen/view.ts";

const view = (over: Partial<View> = {}): View => ({
  best: 12,
  newBest: false,
  phase: "over",
  toast: null,
  ...over,
});
const over = {
  ...startRun(7),
  blocked: true,
  ended: true,
  lines: 34,
  score: 4_200,
};

describe("the card after a run", () => {
  it("has none before the first run or while a run goes", () => {
    expect(resultOf(over, view({ phase: "ready" }))).toBeNull();
    expect(resultOf(over, view({ phase: "running" }))).toBeNull();
  });

  it("says how it ended, the score, the rows and level, the best and how to go again, the ending in the danger colour", () => {
    const card = resultOf(over, view());
    expect(card?.rows.map(({ text }) => text)).toEqual([
      "FROZEN OVER",
      "SCORE 4200",
      "34 ROWS, LEVEL 4",
      "BEST 12",
      "ENTER OR TAP TO GO AGAIN",
    ]);
    expect(card?.rows[0]?.colour).toBe(colour.danger);
    expect(card?.rows[0]?.weight).toBeGreaterThan(card?.rows[1]?.weight ?? 0);
  });

  it("says time when the run ran out, and a new best in place of the old best", () => {
    expect(resultOf({ ...over, blocked: false }, view())?.rows[0]?.text).toBe(
      "TIME",
    );
    const text = resultOf(over, view({ newBest: true }))?.rows.map(
      (row) => row.text,
    );
    expect(text).toContain("NEW BEST!");
    expect(text).not.toContain("BEST 12");
  });
});
