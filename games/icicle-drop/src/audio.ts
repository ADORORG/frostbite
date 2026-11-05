import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import { frequency, type Track } from "@frostbite/game-sdk/audio/tracks";

// Icicle Drop's sound, as data: a calm, glassy loop in C major (a slow bass and pad under a sparse bell tune), a soft tick for a slide, a
// chime that rises with the biggest tile for a join. Nothing here is a file: the SDK plays it with the browser's audio.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

const bass = [48, ...rest(7), 43, ...rest(7), 45, ...rest(7), 41, ...rest(7)];
const pad = [64, ...rest(7), 62, ...rest(7), 65, ...rest(7), 62, ...rest(7)];
const bells = [
  72,
  null,
  76,
  null,
  79,
  null,
  76,
  null,
  74,
  null,
  79,
  null,
  81,
  null,
  79,
  null,
  72,
  null,
  77,
  null,
  81,
  null,
  77,
  null,
  71,
  null,
  74,
  null,
  79,
  null,
  null,
  null,
];

export const track: Track = {
  name: "icicle-drop",
  tempo: 96,
  voices: [
    { gain: 0.2, hold: 7, notes: bass, wave: "triangle" },
    { gain: 0.07, hold: 7, notes: pad, wave: "sine" },
    { gain: 0.12, hold: 2.5, notes: bells, wave: "sine" },
  ],
};

export const effects = {
  lose: commonEffects.lose,
  milestone: commonEffects.win,
  slide: [tone("triangle", 330, 260, 0.07, 0.18)],
  start: commonEffects.start,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;

// A join sounds higher the bigger the biggest tile is: level 1 is a 2, level 11 a 2048.
const lowestJoin = 72;
export function joinSound(biggest: number): Effect {
  const pitch = frequency(lowestJoin + Math.min(biggest, 12) * 2);
  return [
    tone("sine", pitch, pitch * 1.5, 0.18, 0.35),
    tone("sine", pitch * 2, pitch * 2, 0.22, 0.18, 0.05),
  ];
}
