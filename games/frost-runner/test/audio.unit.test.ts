import { frequency, stepsAt } from "@frostbite/game-sdk/audio/tracks";
import { describe, expect, it } from "vitest";

import { effects, track } from "../src/audio.ts";

describe("Frost Runner's sound", () => {
  it("has a track whose notes are playable pitches and whose voices all sound somewhere", () => {
    expect(track.tempo).toBeGreaterThan(60);
    for (const voice of track.voices) {
      expect(voice.notes.some((note) => note !== null)).toBe(true);
      for (const note of voice.notes) {
        if (note === null) continue;
        expect(frequency(note)).toBeGreaterThan(40);
        expect(frequency(note)).toBeLessThan(4000);
      }
    }
    expect(stepsAt(track, 0).length).toBeGreaterThan(0);
  });

  it("has an effect for each thing that happens, each short and audible", () => {
    expect(Object.keys(effects).sort()).toEqual([
      "hit",
      "jump",
      "milestone",
      "shard",
      "slide",
      "start",
    ]);
    for (const effect of Object.values(effects))
      for (const part of effect) {
        expect(part.seconds).toBeLessThan(1);
        expect(part.gain).toBeGreaterThan(0);
      }
  });
});
