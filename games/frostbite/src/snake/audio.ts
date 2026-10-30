import { commonEffects, tone, type Effect } from "@ador/game-sdk/audio/effects";
import type { Track } from "@ador/game-sdk/audio/tracks";

// SAT SNAKE's sound, as data: a quick, tense loop in E minor, a tick for each turn, a bite for each cell the snake grows, and a crash.
const bass = [
  40,
  null,
  40,
  null,
  47,
  null,
  47,
  null,
  43,
  null,
  43,
  null,
  47,
  null,
  50,
  null,
];
const lead = [
  76,
  null,
  79,
  83,
  null,
  79,
  76,
  null,
  74,
  null,
  78,
  81,
  null,
  78,
  74,
  null,
];

export const track: Track = {
  name: "sat-snake",
  tempo: 132,
  voices: [
    { gain: 0.2, hold: 1.5, notes: bass, wave: "triangle" },
    { gain: 0.09, hold: 0.8, notes: lead, wave: "square" },
  ],
};

export const effects = {
  eat: [
    tone("square", 660, 1320, 0.09, 0.3),
    tone("square", 1320, 1760, 0.08, 0.25, 0.07),
  ],
  lose: commonEffects.lose,
  milestone: commonEffects.win,
  start: commonEffects.start,
  turn: [tone("square", 440, 520, 0.04, 0.15)],
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
