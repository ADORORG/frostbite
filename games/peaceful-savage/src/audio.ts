import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

import { concert } from "./concert.ts";

// The game's sound, as data: a slow, warm lullaby in a pentatonic key (a low drone, a soft bass that walks, a music-box tune), and an
// effect for each thing that happens. Nothing here is a file: the SDK plays it with the browser's audio.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

export const track: Track = {
  name: "light-the-tree",
  tempo: 76,
  voices: [
    {
      gain: 0.12,
      hold: 7,
      notes: [43, ...rest(7), 40, ...rest(7), 36, ...rest(7), 38, ...rest(7)],
      wave: "sine",
    },
    {
      gain: 0.1,
      hold: 1.5,
      notes: [
        55,
        null,
        62,
        null,
        59,
        null,
        62,
        null,
        52,
        null,
        59,
        null,
        55,
        null,
        59,
        null,
      ],
      wave: "triangle",
    },
    {
      gain: 0.06,
      hold: 2,
      notes: [
        79,
        ...rest(3),
        76,
        null,
        74,
        null,
        79,
        ...rest(5),
        81,
        ...rest(3),
        79,
        null,
        76,
        null,
        74,
        ...rest(5),
      ],
      wave: "sine",
    },
  ],
};

const bell = (pitch: number, at = 0, gain = 0.3): Effect => [
  tone("sine", pitch, pitch, 0.5, gain, at),
  tone("triangle", pitch * 2, pitch * 2, 0.25, gain * 0.4, at),
];

// Tribal drums for the dance out of the door: a deep drum on every beat, a tom between every other pair, and a light rim in threes,
// swelling over seven seconds.
const drums: Effect = Array.from({ length: 14 }, (_, beat) => {
  const at = beat * 0.5;
  const swell = 0.5 + (beat / 14) * 0.5;
  return [
    tone("sine", 140, 42, 0.42, 0.75 * swell, at),
    ...(beat % 2 === 1
      ? [tone("sine", 210, 120, 0.22, 0.45 * swell, at + 0.25)]
      : []),
    tone("triangle", 520, 380, 0.05, 0.16 * swell, at + 1 / 6),
    tone("triangle", 520, 380, 0.05, 0.12 * swell, at + 1 / 3),
  ];
}).flat();

export const effects = {
  beat: [...bell(784), ...bell(1175, 0.06, 0.2)],
  concert,
  breathIn: [tone("sine", 220, 330, 1.2, 0.18)],
  breathOut: [tone("sine", 330, 196, 1.8, 0.16)],
  drums,
  found: [...bell(523), ...bell(659, 0.12), ...bell(784, 0.24)],
  gather: [...bell(988), ...bell(1319, 0.1, 0.2)],
  good: bell(659),
  jump: [tone("sine", 330, 660, 0.16, 0.14)],
  healed: [
    tone("sine", 523, 1047, 0.5, 0.25),
    ...bell(1319, 0.3, 0.2),
    ...bell(1568, 0.42, 0.15),
  ],
  lamp: [tone("triangle", 880, 880, 0.05, 0.2)],
  level: [...bell(523), ...bell(784, 0.1), ...bell(1047, 0.2)],
  lit: [
    ...bell(392),
    ...bell(523, 0.15),
    ...bell(659, 0.3),
    ...bell(784, 0.45),
    ...bell(1047, 0.6, 0.35),
  ],
  // Something made and kept: a little sung phrase, rising and coming home.
  made: [
    tone("sine", 523, 523, 0.3, 0.16),
    tone("sine", 659, 659, 0.3, 0.16, 0.3),
    tone("sine", 784, 880, 0.45, 0.16, 0.6),
    ...bell(1047, 1.05, 0.2),
  ],
  milestone: commonEffects.win,
  miss: [tone("triangle", 262, 196, 0.25, 0.2)],
  plasma: [tone("sine", 1568, 2093, 0.07, 0.08)],
  rise: [
    tone("sawtooth", 98, 73, 1.6, 0.12),
    tone("sine", 196, 147, 1.6, 0.15),
  ],
  sparky: [...bell(1047), ...bell(1319, 0.08), ...bell(1568, 0.16)],
  start: commonEffects.start,
  thing: [tone("triangle", 660, 740, 0.07, 0.15)],
  touch: [...bell(440, 0, 0.25), tone("sine", 220, 220, 1, 0.12)],
  tricked: [tone("sine", 247, 185, 0.6, 0.18)],
  vision: [
    tone("sine", 1319, 1760, 0.6, 0.12),
    tone("sine", 659, 880, 0.6, 0.1),
  ],
  woven: [
    ...bell(392),
    ...bell(587, 0.1),
    ...bell(784, 0.2),
    ...bell(988, 0.3),
  ],
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
