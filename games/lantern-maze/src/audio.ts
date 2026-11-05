import { commonEffects, tone } from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// Lantern Maze's sound, as data: a slow, low drip of a tune in A minor under a soft pad, and an effect for each thing that happens. The
// page speeds the music up as the oil runs low. Nothing here is a file: the SDK plays it with the browser's audio.
const bass = [
  45,
  null,
  null,
  null,
  45,
  null,
  null,
  null,
  41,
  null,
  null,
  null,
  43,
  null,
  null,
  null,
];
const drip = [
  null,
  null,
  81,
  null,
  null,
  null,
  76,
  null,
  null,
  null,
  79,
  null,
  null,
  72,
  null,
  null,
];
const pad = [
  69,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  65,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
];

export const track: Track = {
  name: "lantern-maze",
  tempo: 92,
  voices: [
    { gain: 0.2, hold: 1.6, notes: bass, wave: "triangle" },
    { gain: 0.07, hold: 0.5, notes: drip, wave: "sine" },
    { gain: 0.05, hold: 3, notes: pad, wave: "triangle" },
  ],
};

export const effects = {
  dark: [tone("sawtooth", 400, 50, 0.7, 0.3)],
  door: commonEffects.good,
  flask: [
    tone("sine", 660, 990, 0.12, 0.28),
    tone("sine", 990, 1320, 0.12, 0.28, 0.1),
  ],
  key: [tone("square", 880, 1760, 0.15, 0.22)],
  milestone: commonEffects.win,
  start: commonEffects.start,
  step: [tone("noise", 0, 0, 0.03, 0.08)],
} as const;

export type EffectName = keyof typeof effects;
