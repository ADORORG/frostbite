import { stubPointer } from "@frostbite/test-kit/touch-screen";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { colour } from "../src/screen/palette.ts";
import { guide } from "../src/guide.ts";
import { cardOf, resultOf } from "../src/screen/result.ts";
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

  it("says how it ended, the floors and the score, and the best", () => {
    for (const [cause, ending] of [
      ["dark", "THE LANTERN WENT OUT"],
      ["escaped", "YOU ESCAPED THE CELLAR"],
      ["spent", "YOUR LEGS GAVE OUT"],
      [null, "RUN OVER"],
    ] as const)
      expect(
        said({ ...startRun(9), cause, floorsCleared: 3, score: 450 }),
      ).toEqual([
        ending,
        "FLOORS 3   SCORE 450",
        "BEST 900",
        expect.stringContaining("ANOTHER CELLAR"),
      ]);
    expect(resultOf(startRun(9), view())?.rows[0]?.colour).toBe(colour.danger);
  });

  it("says a new best, in place of the old one, when there is one", () => {
    expect(said(startRun(9), { newBest: true })).toContain("NEW BEST!");
    expect(said(startRun(9), { newBest: true })).not.toContain("BEST 900");
  });

  it("says Enter to a keyboard", () => {
    stubPointer(false);
    expect(said()).toContain("ENTER FOR ANOTHER CELLAR");
  });

  it("says tap to a finger, and never Enter (a phone has none)", () => {
    stubPointer(true);
    expect(said()).toContain("TAP FOR ANOTHER CELLAR");
    expect(said().join(" ")).not.toContain("ENTER");
  });
});

describe("what is over the screen", () => {
  it("is the first-screen card before a run, the card after a run once it is over, and nothing while a run goes", () => {
    const state = startRun(9);
    expect(cardOf(state, view({ phase: "ready" }))).toBe(guide);
    expect(cardOf(state, view({ phase: "over" }))).toEqual(
      resultOf(state, view({ phase: "over" })),
    );
    expect(cardOf(state, view({ phase: "over" }))).not.toBeNull();
    expect(cardOf(state, view({ phase: "running" }))).toBeNull();
  });
});
