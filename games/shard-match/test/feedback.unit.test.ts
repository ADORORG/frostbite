import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";
import { swapSounds, tempoFor, toastFor } from "../src/feedback.ts";
import { startRun } from "../src/rules/state.ts";

describe("what is heard", () => {
  const base = startRun(1);
  it("is a match that rings higher the longer its chain, and then what else the swap did", () => {
    expect(swapSounds(base, { ...base, lastDepth: 1 })).toEqual(["match0"]);
    expect(swapSounds(base, { ...base, lastDepth: 3 })).toEqual(["match2"]);
    expect(swapSounds(base, { ...base, lastDepth: 99 })).toEqual(["match4"]);
    expect(swapSounds(base, { ...base, lastDepth: 0 })).toEqual(["match0"]);
    expect(swapSounds(base, { ...base, bombsFired: 1, lastDepth: 1 })).toEqual([
      "match0",
      "blast",
    ]);
    expect(swapSounds(base, { ...base, bombsMade: 1, lastDepth: 1 })).toEqual([
      "match0",
      "special",
    ]);
    expect(swapSounds(base, { ...base, lastDepth: 1, starsMade: 1 })).toEqual([
      "match0",
      "special",
    ]);
    expect(swapSounds(base, { ...base, lastDepth: 1, reshuffles: 1 })).toEqual([
      "match0",
      "shuffle",
    ]);
    expect(swapSounds(base, { ...base, lastDepth: 1, level: 2 })).toEqual([
      "match0",
      "level",
    ]);
    expect(swapSounds(base, { ...base, ended: true, lastDepth: 1 })).toEqual([
      "match0",
      "lose",
    ]);
  });

  it("says the gain, and the chain when it ran past one step", () => {
    expect(toastFor({ ...base, lastDepth: 1, lastGain: 30 })).toBe("+30");
    expect(toastFor({ ...base, lastDepth: 2, lastGain: 90 })).toBe(
      "CHAIN x2  +90",
    );
  });

  it("speeds the music up as the swaps run low, to half again", () => {
    expect(tempoFor(30)).toBe(1);
    expect(tempoFor(6)).toBe(1);
    expect(tempoFor(5)).toBeCloseTo(1.0833, 3);
    expect(tempoFor(0)).toBe(1.5);
  });

  it("has a sound for every one it can ask for", () => {
    for (const name of [
      "match0",
      "match4",
      "blast",
      "special",
      "shuffle",
      "level",
      "lose",
      "milestone",
      "start",
    ])
      expect(Object.keys(effects)).toContain(name);
    expect(track.voices.every(({ notes }) => notes.length === 16)).toBe(true);
  });
});
