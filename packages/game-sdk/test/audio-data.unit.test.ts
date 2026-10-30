import { describe, expect, it } from "vitest";

import { commonEffects } from "../src/audio/effects.ts";
import {
  defaultSound,
  parseSound,
  soundSettingsSchema,
} from "../src/audio/settings.ts";
import {
  frequency,
  stepSeconds,
  stepsAt,
  type Track,
} from "../src/audio/tracks.ts";

describe("sound settings", () => {
  it("read back what was saved, and fall back to the defaults for anything else", () => {
    const saved = { effects: false, music: true, volume: 0.25 };
    expect(parseSound(saved)).toEqual(saved);
    for (const wrong of [
      null,
      undefined,
      "loud",
      { ...saved, volume: 1.5 },
      { ...saved, volume: -0.1 },
      { ...saved, music: "yes" },
      { ...saved, extra: 1 },
      { music: true },
    ])
      expect(parseSound(wrong)).toEqual(defaultSound);
  });

  it("start with everything on at a moderate volume", () => {
    expect(soundSettingsSchema.safeParse(defaultSound).success).toBe(true);
    expect(defaultSound).toMatchObject({ effects: true, music: true });
    expect(defaultSound.volume).toBeGreaterThan(0);
    expect(defaultSound.volume).toBeLessThan(1);
  });
});

describe("music as data", () => {
  it("puts A4 at 440 hertz and doubles the pitch each octave", () => {
    expect(frequency(69)).toBeCloseTo(440);
    expect(frequency(81)).toBeCloseTo(880);
    expect(frequency(57)).toBeCloseTo(220);
  });

  it("makes a step an eighth note: two to a beat", () => {
    expect(stepSeconds(120)).toBeCloseTo(0.25);
    expect(stepSeconds(60)).toBeCloseTo(0.5);
  });

  it("starts each voice's note on its step, loops voices on their own length, and skips rests", () => {
    const track: Track = {
      name: "t",
      tempo: 100,
      voices: [
        { gain: 0.3, hold: 1, notes: [60, null, 62], wave: "square" },
        { gain: 0.2, hold: 2, notes: [40, 41], wave: "triangle" },
      ],
    };
    expect(stepsAt(track, 0).map(({ midi }) => midi)).toEqual([60, 40]);
    expect(stepsAt(track, 1).map(({ midi }) => midi)).toEqual([41]);
    expect(stepsAt(track, 3).map(({ midi }) => midi)).toEqual([60, 41]);
    expect(stepsAt(track, 5)).toEqual([
      { gain: 0.3, hold: 1, midi: 62, wave: "square" },
      { gain: 0.2, hold: 2, midi: 41, wave: "triangle" },
    ]);
  });
});

describe("the shared effects", () => {
  it("each have tones that start no earlier than the effect and last a little while", () => {
    for (const effect of Object.values(commonEffects)) {
      expect(effect.length).toBeGreaterThan(0);
      for (const part of effect) {
        expect(part.at).toBeGreaterThanOrEqual(0);
        expect(part.seconds).toBeGreaterThan(0);
        expect(part.seconds).toBeLessThan(1);
        expect(part.gain).toBeGreaterThan(0);
        expect(part.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});
