import { commonEffects, tone, type Effect } from "@ador/game-sdk/audio/effects";
import type { Track } from "@ador/game-sdk/audio/tracks";

// Snowball Dash's sound, as data: a rolling groove in D minor (a steady bass under a falling-snow tune), and an effect for each thing
// that happens. Nothing here is a file: the SDK plays it with the browser's audio.
const bass = [
  38,
  null,
  38,
  null,
  45,
  null,
  38,
  null,
  34,
  null,
  34,
  null,
  41,
  null,
  34,
  null,
];
const tune = [
  74,
  null,
  77,
  81,
  null,
  77,
  74,
  null,
  72,
  null,
  76,
  79,
  null,
  76,
  72,
  null,
];

export const track: Track = {
  name: "snowball-dash",
  tempo: 132,
  voices: [
    { gain: 0.22, hold: 1.5, notes: bass, wave: "triangle" },
    { gain: 0.09, hold: 0.9, notes: tune, wave: "square" },
  ],
};

export const effects = {
  crash: commonEffects.lose,
  hop: [tone("square", 300, 640, 0.13, 0.3)],
  landed: [tone("noise", 0, 0, 0.05, 0.1)],
  milestone: commonEffects.win,
  start: commonEffects.start,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
