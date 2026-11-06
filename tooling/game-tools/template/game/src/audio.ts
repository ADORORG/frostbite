import {
  commonEffects,
  tone,
  type Effect,
} from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// The game's sound, as data: a short steady loop, a chime for a catch and a thud for a miss. Nothing here is a file: the SDK plays it with
// the browser's audio.
const rest = (count: number): null[] =>
  Array.from({ length: count }, () => null);

export const track: Track = {
  name: "starter-game",
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
  catch: [tone("square", 660, 880, 0.12, 0.3)],
  miss: [tone("sawtooth", 220, 80, 0.4, 0.4), tone("noise", 0, 0, 0.25, 0.2)],
  milestone: commonEffects.win,
  start: commonEffects.start,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
