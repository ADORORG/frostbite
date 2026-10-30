import { frequency } from "@ador/game-sdk/audio/tracks";
import { describe, expect, it } from "vitest";

import { effects, perfectSound, track } from "../src/audio.ts";
import { dropSounds, tempoScale } from "../src/feedback.ts";
import { startTower } from "../src/rules/state.ts";

const base = startTower(7);

describe("the sound of a drop", () => {
  it("is a tumble when the drop missed the tower", () => {
    expect(dropSounds(base, { ...base, over: true })).toEqual([
      { kind: "fall" },
    ]);
    // A run that was already over makes no new sound.
    expect(
      dropSounds({ ...base, over: true }, { ...base, over: true }),
    ).toEqual([{ kind: "land" }]);
  });

  it("is a thud when the drop landed but was trimmed", () => {
    expect(dropSounds(base, { ...base, width: base.width - 3 })).toEqual([
      { kind: "land" },
    ]);
  });

  it("is a chime that knows the streak when the drop was perfect, and a lift too when the tower grew back", () => {
    const perfect = { ...base, perfects: base.perfects + 1, streak: 4 };
    expect(dropSounds(base, perfect)).toEqual([{ kind: "perfect", streak: 4 }]);
    expect(dropSounds(base, { ...perfect, width: base.width + 4 })).toEqual([
      { kind: "perfect", streak: 4 },
      { kind: "regrow" },
    ]);
  });

  it("rings higher for each perfect drop in a row, and stops climbing after twelve", () => {
    const pitch = (streak: number) => perfectSound(streak)[0]?.from ?? 0;
    expect(pitch(2)).toBeGreaterThan(pitch(1));
    expect(pitch(12)).toBeGreaterThan(pitch(11));
    expect(pitch(50)).toBe(pitch(12));
    expect(pitch(50)).toBeLessThan(frequency(120));
    for (const part of perfectSound(3)) expect(part.seconds).toBeLessThan(1);
  });
});

describe("the music's pace", () => {
  it("starts at the track's own tempo, quickens a fiftieth for each block, and tops out at half as fast again", () => {
    expect(tempoScale(0)).toBe(1);
    expect(tempoScale(25)).toBeCloseTo(1.5);
    expect(tempoScale(10)).toBeCloseTo(1.2);
    expect(tempoScale(500)).toBe(1.5);
  });
});

describe("Tower Stacker's sound", () => {
  it("has a track whose notes are playable and whose voices all sound somewhere", () => {
    expect(track.tempo).toBeGreaterThan(60);
    for (const voice of track.voices) {
      expect(voice.notes.some((note) => note !== null)).toBe(true);
      for (const note of voice.notes) {
        if (note === null) continue;
        expect(frequency(note)).toBeGreaterThan(40);
        expect(frequency(note)).toBeLessThan(4000);
      }
    }
  });

  it("has an effect for each thing that happens, each short and audible", () => {
    expect(Object.keys(effects).sort()).toEqual([
      "fall",
      "land",
      "milestone",
      "regrow",
      "start",
    ]);
    for (const effect of Object.values(effects))
      for (const part of effect) {
        expect(part.seconds).toBeLessThan(1);
        expect(part.gain).toBeGreaterThan(0);
      }
  });
});
