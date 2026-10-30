import { commonEffects, tone } from "@ador/game-sdk/audio/effects";
import type { Track } from "@ador/game-sdk/audio/tracks";

// Shard Match's sound, as data: a bright, bouncing tune in C major over a walking bass, and an effect for each thing that happens, with a match
// that rings higher the longer the chain it started. Nothing here is a file: the SDK plays it with the browser's audio.
const bass = [
  36,
  null,
  43,
  null,
  36,
  null,
  43,
  null,
  41,
  null,
  48,
  null,
  41,
  null,
  43,
  null,
];
const tune = [72, 76, 79, 76, 72, 76, 79, 84, 77, 81, 84, 81, 79, 76, 74, 76];
const high = [
  null,
  null,
  91,
  null,
  null,
  null,
  88,
  null,
  null,
  null,
  93,
  null,
  null,
  null,
  91,
  null,
];

export const track: Track = {
  name: "shard-match",
  tempo: 128,
  voices: [
    { gain: 0.2, hold: 1.2, notes: bass, wave: "triangle" },
    { gain: 0.08, hold: 0.7, notes: tune, wave: "square" },
    { gain: 0.04, hold: 1.2, notes: high, wave: "sine" },
  ],
};

const match = (pitch: number) => [
  tone("triangle", pitch, pitch * 1.5, 0.1, 0.3),
  tone("sine", pitch * 2, pitch * 3, 0.12, 0.18, 0.06),
];

export const effects = {
  blast: [
    tone("noise", 0, 0, 0.25, 0.3),
    tone("sawtooth", 300, 60, 0.25, 0.25),
  ],
  level: commonEffects.good,
  lose: commonEffects.lose,
  match0: match(523),
  match1: match(587),
  match2: match(659),
  match3: match(784),
  match4: match(988),
  milestone: commonEffects.win,
  shuffle: [tone("square", 200, 800, 0.2, 0.2)],
  swap: [tone("triangle", 330, 440, 0.05, 0.18)],
  special: [tone("square", 880, 1760, 0.18, 0.24)],
  start: commonEffects.start,
} as const;

export type EffectName = keyof typeof effects;
