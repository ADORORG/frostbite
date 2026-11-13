import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// The game's sound, as data: a short steady loop, a click for each turn, a thud as a piece sets, and chimes for rows. Nothing here is a file: the SDK plays it with
// the browser's audio.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

export const track: Track = {
  name: "permafrost",
  tempo: 108,
  voices: [
    {
      gain: 0.2,
      hold: 1.5,
      notes: [45, ...rest(3), 45, ...rest(3), 52, ...rest(3), 50, ...rest(3)],
      wave: "triangle",
    },
    {
      gain: 0.08,
      hold: 1.5,
      notes: [
        69,
        null,
        72,
        null,
        76,
        null,
        72,
        null,
        67,
        null,
        71,
        null,
        74,
        null,
        71,
        null,
      ],
      wave: "square",
    },
  ],
};

export const effects = {
  clear: [tone("square", 520, 780, 0.14, 0.3)],
  four: [
    tone("square", 520, 1040, 0.2, 0.3),
    tone("triangle", 260, 520, 0.3, 0.3),
  ],
  hold: [tone("triangle", 420, 300, 0.07, 0.2)],
  level: [tone("square", 440, 880, 0.3, 0.3)],
  lock: [tone("square", 140, 90, 0.08, 0.25)],
  milestone: commonEffects.win,
  over: [tone("sawtooth", 220, 80, 0.5, 0.4), tone("noise", 0, 0, 0.3, 0.2)],
  perfect: commonEffects.win,
  start: commonEffects.start,
  turn: [tone("square", 560, 640, 0.04, 0.15)],
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
