import { describe, expect, it } from "vitest";

import { startRun } from "../src/rules/state.ts";
import { colour } from "../src/screen/palette.ts";
import { guide } from "../src/guide.ts";
import { cardOf, resultOf } from "../src/screen/result.ts";
import type { View } from "../src/screen/view.ts";

// The card after a run is the SDK's, drawn over the screen at the display's pixels; the game says what is on it.
const view = (over: Partial<View> = {}): View => ({
  best: 100,
  newBest: false,
  phase: "over",
  toast: null,
  ...over,
});
const dead = (cause: "fell" | "hit") => ({
  ...startRun(9),
  alive: false,
  cause,
  score: 777,
});
const said = (cause: "fell" | "hit", over: Partial<View> = {}) =>
  resultOf(dead(cause), view(over))?.rows.map(({ text }) => text);

describe("the card after a run", () => {
  it("has none before the first run or while a run goes", () => {
    expect(resultOf(startRun(9), view({ phase: "ready" }))).toBeNull();
    expect(resultOf(startRun(9), view({ phase: "running" }))).toBeNull();
  });

  it("says how it ended, the score, the best and how to go again, the ending in the danger colour", () => {
    const card = resultOf(dead("hit"), view());
    expect(card?.rows.map(({ text }) => text)).toEqual([
      "RUN OVER",
      "SCORE 777",
      "BEST 100",
      "ENTER, SPACE OR TAP TO ROLL AGAIN",
    ]);
    expect(card?.rows[0]?.colour).toBe(colour.danger);
    expect(card?.rows[0]?.weight).toBeGreaterThan(card?.rows[1]?.weight ?? 0);
  });

  it("names the crevasse when the snowball fell", () => {
    expect(said("fell")?.[0]).toBe("INTO THE CREVASSE");
  });

  it("says a new best, in place of the old one, when there is one", () => {
    expect(said("hit", { newBest: true })).toContain("NEW BEST!");
    expect(said("hit", { newBest: true })).not.toContain("BEST 100");
    expect(said("hit")).not.toContain("NEW BEST!");
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
