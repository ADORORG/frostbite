import { stubPointer } from "@frostbite/test-kit/touch-screen";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startRun, type MatchState } from "../src/rules/state.ts";
import { colour } from "../src/screen/palette.ts";
import { resultOf } from "../src/screen/result.ts";
import type { View } from "../src/screen/view.ts";

// The card after a run is the SDK's, drawn over the screen at the display's pixels; the game says what is on it.
const view = (over: Partial<View> = {}): View => ({
  best: 900,
  cursor: 0,
  grab: -1,
  hint: [],
  newBest: false,
  phase: "over",
  shape: "wide",
  toast: null,
  ...over,
});
const ended: MatchState = {
  ...startRun(9),
  cause: "out",
  levelsCleared: 4,
  score: 450,
};
const said = (state = ended, over: Partial<View> = {}) =>
  resultOf(state, view(over))?.rows.map(({ text }) => text) ?? [];
afterEach(() => vi.unstubAllGlobals());

describe("the card after a run", () => {
  it("has none before the first run or while a run goes", () => {
    expect(resultOf(ended, view({ phase: "ready" }))).toBeNull();
    expect(resultOf(ended, view({ phase: "running" }))).toBeNull();
  });

  it("says how it ended, the levels and the score on one line, and the best", () => {
    stubPointer(false);
    expect(said()).toEqual([
      "OUT OF SWAPS",
      "LEVELS 4   SCORE 450",
      "BEST 900",
      "ENTER TO PLAY AGAIN",
    ]);
    expect(said({ ...ended, cause: "spent" })[0]).toBe("WHAT A RUN!");
    expect(resultOf(ended, view())?.rows[0]?.colour).toBe(colour.danger);
  });

  it("says a new best, in place of the old one, when there is one", () => {
    expect(said(ended, { newBest: true })).toContain("NEW BEST!");
    expect(said(ended, { newBest: true })).not.toContain("BEST 900");
  });

  it("is shorter lines on the tall screen, which says Start and not Enter", () => {
    const tall = said(ended, { shape: "tall" });
    expect(tall).toEqual([
      "OUT OF SWAPS",
      "LEVELS 4",
      "SCORE 450",
      "BEST 900",
      "PRESS START TO PLAY AGAIN",
    ]);
    expect(tall.join(" ")).not.toContain("ENTER");
  });

  it("says Enter to a keyboard and tap to a finger, and never Enter to a finger", () => {
    stubPointer(false);
    expect(said()).toContain("ENTER TO PLAY AGAIN");
    stubPointer(true);
    expect(said()).toContain("TAP TO PLAY AGAIN");
    expect(said().join(" ")).not.toContain("ENTER");
  });
});
