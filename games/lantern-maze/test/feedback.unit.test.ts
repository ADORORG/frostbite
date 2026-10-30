import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";
import { stepSounds, tempoFor } from "../src/feedback.ts";
import { startRun } from "../src/rules/state.ts";

describe("what is heard", () => {
  const base = startRun(1);
  it("is a step, and then what the step did", () => {
    expect(stepSounds(base, { ...base, moves: 1 })).toEqual(["step"]);
    expect(stepSounds(base, { ...base, flasksTaken: 1 })).toEqual([
      "step",
      "flask",
    ]);
    expect(stepSounds(base, { ...base, hasKey: true })).toEqual([
      "step",
      "key",
    ]);
    expect(stepSounds(base, { ...base, floorsCleared: 1 })).toEqual([
      "step",
      "door",
    ]);
    expect(stepSounds(base, { ...base, cause: "dark" })).toEqual([
      "step",
      "dark",
    ]);
    expect(
      stepSounds({ ...base, hasKey: true }, { ...base, hasKey: true }),
    ).toEqual(["step"]);
    expect(stepSounds(base, { ...base, cause: "escaped" })).toEqual(["step"]);
  });

  it("speeds the music up as the oil runs low, to half again", () => {
    expect(tempoFor(500)).toBe(1);
    expect(tempoFor(40)).toBe(1);
    expect(tempoFor(39)).toBeCloseTo(1.0125);
    expect(tempoFor(0)).toBe(1.5);
  });

  it("has a sound for every one it can ask for", () => {
    for (const name of [
      "step",
      "flask",
      "key",
      "door",
      "dark",
      "milestone",
      "start",
    ])
      expect(Object.keys(effects)).toContain(name);
    expect(track.voices.every(({ notes }) => notes.length === 16)).toBe(true);
  });
});
