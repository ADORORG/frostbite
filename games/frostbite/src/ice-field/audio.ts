import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// The ice field's sound, as data: a slow, glassy loop in A minor, a tap for a safe tile, a crack for a mine, a chime for a board won.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

const bass = [45, ...rest(7), 41, ...rest(7), 43, ...rest(7), 40, ...rest(7)];
const bells = [
  69,
  null,
  72,
  null,
  76,
  null,
  null,
  null,
  67,
  null,
  71,
  null,
  74,
  null,
  null,
  null,
  65,
  null,
  69,
  null,
  72,
  null,
  null,
  null,
  64,
  null,
  67,
  null,
  71,
  null,
  null,
  null,
];

export const track: Track = {
  name: "ice-field",
  tempo: 88,
  voices: [
    { gain: 0.2, hold: 7, notes: bass, wave: "triangle" },
    { gain: 0.1, hold: 2.5, notes: bells, wave: "sine" },
  ],
};

export const effects = {
  build: commonEffects.good,
  lose: commonEffects.lose,
  safe: [tone("sine", 520, 700, 0.07, 0.3)],
  start: commonEffects.start,
  win: commonEffects.win,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
