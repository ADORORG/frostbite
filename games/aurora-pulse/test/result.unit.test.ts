import { stubPointer } from "@frostbite/test-kit/touch-screen";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { colour } from "../src/screen/palette.ts";
import { resultOf } from "../src/screen/result.ts";
import type { View } from "../src/screen/view.ts";

// The card after a run is the SDK's, drawn over the screen at the display's pixels; the game says what is on it.
const view = (over: Partial<View> = {}): View => ({
  best: 900,
  newBest: false,
  phase: "over",
  toast: null,
  ...over,
});
const said = (state = startRun(9), over: Partial<View> = {}) =>
  resultOf(state, view(over))?.rows.map(({ text }) => text) ?? [];
afterEach(() => vi.unstubAllGlobals());

describe("the card after a run", () => {
  it("has none before the first run or while a run goes", () => {
    expect(resultOf(startRun(9), view({ phase: "ready" }))).toBeNull();
    expect(resultOf(startRun(9), view({ phase: "running" }))).toBeNull();
  });

  it("says how it ended, the stage and the score, and the best", () => {
    for (const [cause, ending] of [
      ["faded", "THE LIGHT WENT OUT"],
      ["finished", "TRACK COMPLETE"],
      ["spent", "THE LIGHT WENT OUT"],
    ] as const)
      expect(
        said({ ...startRun(9), cause, score: 450, tick: 96 + 1024 * 3 }),
      ).toEqual([
        ending,
        "STAGE 4   SCORE 450",
        "BEST 900",
        expect.stringContaining("PLAY AGAIN"),
      ]);
    expect(resultOf(startRun(9), view())?.rows[0]?.colour).toBe(colour.danger);
  });

  it("says a new best, in place of the old one, when there is one", () => {
    expect(said(startRun(9), { newBest: true })).toContain("NEW BEST!");
    expect(said(startRun(9), { newBest: true })).not.toContain("BEST 900");
  });

  it("says Enter to a keyboard", () => {
    stubPointer(false);
    expect(said()).toContain("ENTER TO PLAY AGAIN");
  });

  it("says tap to a finger, and never Enter (a phone has none)", () => {
    stubPointer(true);
    expect(said()).toContain("TAP TO PLAY AGAIN");
    expect(said().join(" ")).not.toContain("ENTER");
  });
});
