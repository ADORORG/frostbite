import { commonEffects, tone, type Effect } from "@ador/game-sdk/audio/effects";
import type { Track } from "@ador/game-sdk/audio/tracks";

// Frost Runner's sound, as data: a running groove in A minor (a walking bass under a bright arpeggio), and an effect for each thing
// that happens. Nothing here is a file: the SDK plays it with the browser's audio.
const bass = [
  45,
  null,
  45,
  null,
  45,
  null,
  48,
  null,
  43,
  null,
  43,
  null,
  43,
  null,
  47,
  null,
  41,
  null,
  41,
  null,
  41,
  null,
  45,
  null,
  43,
  null,
  43,
  null,
  43,
  null,
  47,
  50,
];
const arpeggio = [
  69, 72, 76, 72, 69, 72, 76, 81, 67, 71, 74, 71, 67, 71, 74, 79, 65, 69, 72,
  69, 65, 69, 72, 77, 67, 71, 74, 79, 74, 71, 74, 71,
];
// A second, softer voice an octave up that comes in on the off beats.
const sparkle = arpeggio.map((note, step) =>
  step % 4 === 2 ? note + 12 : null,
);

export const track: Track = {
  name: "frost-runner",
  tempo: 150,
  voices: [
    { gain: 0.22, hold: 1.6, notes: bass, wave: "triangle" },
    { gain: 0.1, hold: 0.9, notes: arpeggio, wave: "square" },
    { gain: 0.05, hold: 0.6, notes: sparkle, wave: "sine" },
  ],
};

export const effects = {
  hit: commonEffects.lose,
  jump: [tone("square", 280, 720, 0.14, 0.3)],
  milestone: commonEffects.win,
  shard: [
    tone("square", 988, 1319, 0.07, 0.3),
    tone("square", 1319, 1760, 0.1, 0.3, 0.06),
  ],
  slide: [
    tone("sawtooth", 700, 200, 0.16, 0.25),
    tone("noise", 0, 0, 0.1, 0.12),
  ],
  start: commonEffects.start,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
