import { describe, expect, it } from "vitest";

import { soundsFor, tempoScale } from "../src/feedback.ts";
import { startRun } from "../src/rules/state.ts";

const before = startRun(1);

describe("what the player hears", () => {
  it("is nothing for a tick in which nothing happened", () => {
    expect(soundsFor(before, { ...before, tick: 1 })).toEqual([]);
  });

  it("is a thud as a piece is set down without a row", () => {
    expect(soundsFor(before, { ...before, pieces: 1 })).toEqual(["lock"]);
  });

  it("is a chime for rows, a bigger one for four, and the biggest for an empty board", () => {
    expect(soundsFor(before, { ...before, lines: 2, pieces: 1 })).toEqual([
      "clear",
    ]);
    expect(
      soundsFor(before, { ...before, fours: 1, lines: 4, pieces: 1 }),
    ).toEqual(["four"]);
    expect(
      soundsFor(before, {
        ...before,
        fours: 1,
        lines: 4,
        perfectClears: 1,
        pieces: 1,
      }),
    ).toEqual(["perfect"]);
  });

  it("adds a fanfare when the rows take the player to a new level, and not when they do not", () => {
    const near = { ...before, lines: 8 };
    expect(soundsFor(near, { ...near, lines: 10, pieces: 1 })).toEqual([
      "clear",
      "level",
    ]);
    expect(soundsFor(near, { ...near, lines: 9, pieces: 1 })).toEqual([
      "clear",
    ]);
  });

  it("is a low groan when the stack reaches the top, whatever else happened", () => {
    expect(
      soundsFor(before, { ...before, blocked: true, lines: 1, pieces: 1 }),
    ).toEqual(["over"]);
    const over = { ...before, blocked: true };
    expect(soundsFor(over, { ...over, tick: 9 })).toEqual([]);
  });

  it("is music that runs faster as the level rises, by a fortieth a level, to a third faster", () => {
    expect(tempoScale(1)).toBe(1);
    expect(tempoScale(11)).toBeCloseTo(1.25);
    expect(tempoScale(40)).toBeCloseTo(4 / 3);
    expect(tempoScale(100)).toBeCloseTo(4 / 3);
  });
});
