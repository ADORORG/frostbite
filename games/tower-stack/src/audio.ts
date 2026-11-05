import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import { frequency, type Track } from "@frostbite/game-sdk/audio/tracks";

// Tower Stacker's sound, as data: a steady, hopeful loop in D minor that the page speeds up as the tower climbs, a thud for a block that
// lands, a chime that climbs with the streak of perfect drops, and a tumble for the block that misses. Nothing here is a file: the SDK
// plays it with the browser's audio.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

const bass = [
  38,
  null,
  38,
  null,
  45,
  null,
  45,
  null,
  34,
  null,
  34,
  null,
  41,
  null,
  41,
  null,
  36,
  null,
  36,
  null,
  43,
  null,
  43,
  null,
  33,
  null,
  33,
  null,
  40,
  null,
  45,
  40,
];
const lead = [
  74,
  null,
  77,
  null,
  81,
  null,
  77,
  null,
  74,
  null,
  76,
  null,
  77,
  null,
  null,
  null,
  72,
  null,
  76,
  null,
  79,
  null,
  76,
  null,
  69,
  null,
  72,
  null,
  76,
  null,
  null,
  null,
];
const pulse = [62, ...rest(3), 62, ...rest(3), 60, ...rest(3), 60, ...rest(3)];

export const track: Track = {
  name: "tower-stack",
  tempo: 118,
  voices: [
    { gain: 0.22, hold: 1.5, notes: bass, wave: "triangle" },
    { gain: 0.1, hold: 1.7, notes: lead, wave: "square" },
    { gain: 0.05, hold: 3, notes: pulse, wave: "sine" },
  ],
};

export const effects = {
  fall: [
    tone("sawtooth", 260, 70, 0.55, 0.4),
    tone("noise", 0, 0, 0.35, 0.25, 0.04),
  ],
  land: [tone("sine", 190, 70, 0.12, 0.45), tone("noise", 0, 0, 0.05, 0.18)],
  milestone: commonEffects.win,
  regrow: commonEffects.good,
  start: commonEffects.start,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;

// A perfect drop rings higher for each one in a row, up to an octave and a half above where it began.
const lowestPerfect = 76;
const mostSteps = 12;
export function perfectSound(streak: number): Effect {
  const pitch = frequency(lowestPerfect + Math.min(streak, mostSteps) * 2);
  return [
    tone("square", pitch, pitch, 0.07, 0.3),
    tone("square", pitch * 1.5, pitch * 1.5, 0.14, 0.3, 0.06),
  ];
}
