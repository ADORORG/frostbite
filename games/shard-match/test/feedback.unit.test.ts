import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";
import { tempoFor, toastFor } from "../src/feedback.ts";
import { startRun } from "../src/rules/state.ts";

describe("what is said and heard", () => {
  const base = startRun(1);
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

  it("has a sound for every one the playback asks for", () => {
    for (const name of [
      "swap",
      "match0",
      "match1",
      "match2",
      "match3",
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
