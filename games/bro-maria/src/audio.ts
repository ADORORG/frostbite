import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// Bro Maria's sound, as data: a bouncy loop in C major (a walking bass under a hopping tune, with a soft chord now and then), and an effect
// for each thing that happens. Nothing here is a file: the SDK plays it with the browser's audio.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

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
  48,
  null,
  43,
  null,
  50,
  null,
  43,
  null,
  50,
  null,
  36,
  null,
  43,
  null,
  45,
  null,
  47,
  null,
];
const tune = [
  72,
  null,
  76,
  null,
  79,
  76,
  72,
  null,
  77,
  null,
  81,
  null,
  77,
  76,
  72,
  null,
  79,
  null,
  83,
  null,
  79,
  77,
  74,
  null,
  72,
  76,
  79,
  84,
  null,
  79,
  76,
  72,
];
const chords = [64, ...rest(7), 65, ...rest(7), 67, ...rest(7), 64, ...rest(7)];

export const track: Track = {
  name: "bro-maria",
  tempo: 152,
  voices: [
    { gain: 0.22, hold: 1.4, notes: bass, wave: "triangle" },
    { gain: 0.1, hold: 0.9, notes: tune, wave: "square" },
    { gain: 0.05, hold: 7, notes: chords, wave: "sine" },
  ],
};

export const effects = {
  bump: [tone("square", 180, 120, 0.1, 0.35), tone("noise", 0, 0, 0.04, 0.15)],
  checkpoint: commonEffects.good,
  coin: [
    tone("square", 988, 988, 0.05, 0.28),
    tone("square", 1319, 1319, 0.14, 0.28, 0.05),
  ],
  die: commonEffects.lose,
  finish: commonEffects.win,
  stage: commonEffects.good,
  hit: [tone("sawtooth", 400, 150, 0.25, 0.35), tone("noise", 0, 0, 0.12, 0.2)],
  jump: [tone("square", 260, 640, 0.16, 0.28)],
  milestone: commonEffects.win,
  start: commonEffects.start,
  stomp: [
    tone("square", 300, 150, 0.06, 0.35),
    tone("square", 450, 900, 0.1, 0.3, 0.05),
  ],
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
