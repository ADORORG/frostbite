import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// The game's sound, as data: an icy loop (E minor, C, A minor, B minor) and the effects. Nothing here is a file; the SDK plays it with the
// browser's own audio. The crystal's three rising notes are the confirm motif, heard only when a crystal is taken.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);
const spaced = (notes: readonly number[]): (number | null)[] =>
  notes.flatMap((note) => [note, null]);

export const track: Track = {
  name: "frost-run",
  tempo: 112,
  voices: [
    {
      gain: 0.2,
      hold: 1.6,
      notes: [
        40,
        null,
        null,
        null,
        40,
        null,
        47,
        null,
        48,
        null,
        null,
        null,
        48,
        null,
        43,
        null,
        45,
        null,
        null,
        null,
        45,
        null,
        40,
        null,
        47,
        null,
        null,
        null,
        47,
        null,
        50,
        null,
      ],
      wave: "triangle",
    },
    {
      gain: 0.055,
      hold: 1.2,
      notes: spaced([
        76, 79, 83, 79, 72, 76, 79, 76, 69, 72, 76, 72, 71, 74, 78, 74,
      ]),
      wave: "square",
    },
    {
      gain: 0.06,
      hold: 7,
      notes: [59, ...rest(7), 60, ...rest(7), 57, ...rest(7), 62, ...rest(7)],
      wave: "sine",
    },
  ],
};

export const effects = {
  bolt: [tone("square", 1400, 700, 0.09, 0.2)],
  breakOpen: [
    tone("noise", 0, 0, 0.2, 0.3),
    tone("triangle", 1200, 600, 0.15, 0.25),
  ],
  burst: [tone("noise", 0, 0, 0.18, 0.28)],
  crush: [tone("noise", 0, 0, 0.12, 0.3), tone("square", 200, 400, 0.08, 0.2)],
  crystal: [
    tone("square", 988, 988, 0.06, 0.32),
    tone("square", 1319, 1319, 0.06, 0.32, 0.06),
    tone("triangle", 1976, 1976, 0.2, 0.3, 0.12),
  ],
  dart: [tone("sine", 2400, 1800, 0.25, 0.12)],
  egg: [
    tone("triangle", 523, 659, 0.08, 0.4),
    tone("triangle", 784, 784, 0.12, 0.35, 0.08),
  ],
  freeHit: [
    tone("triangle", 880, 440, 0.2, 0.3),
    tone("sine", 1320, 1760, 0.15, 0.2, 0.05),
  ],
  grow: [
    tone("sawtooth", 110, 440, 0.45, 0.3),
    tone("square", 220, 880, 0.45, 0.12),
  ],
  hit: [tone("sawtooth", 260, 90, 0.3, 0.4), tone("noise", 0, 0, 0.18, 0.3)],
  hop: [tone("square", 300, 620, 0.1, 0.2)],
  key: [
    tone("sine", 1568, 1568, 0.25, 0.4),
    tone("sine", 2093, 2093, 0.3, 0.25, 0.05),
  ],
  land: [tone("noise", 0, 0, 0.06, 0.1)],
  lose: commonEffects.lose,
  milestone: commonEffects.good,
  roll: [tone("triangle", 200, 500, 0.2, 0.25)],
  roundClear: commonEffects.win,
  roundStart: commonEffects.start,
  select: commonEffects.click,
  shatter: [
    tone("noise", 0, 0, 0.12, 0.25),
    tone("square", 1800, 900, 0.08, 0.15),
  ],
  splash: [tone("noise", 0, 0, 0.35, 0.3), tone("sine", 400, 120, 0.3, 0.25)],
  start: commonEffects.start,
  tick: [tone("square", 880, 880, 0.05, 0.15)],
  vision: [
    tone("sine", 660, 1320, 0.5, 0.25),
    tone("sine", 990, 1980, 0.5, 0.15, 0.1),
  ],
  win: [...commonEffects.win, tone("triangle", 1568, 2093, 0.4, 0.25, 0.45)],
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
