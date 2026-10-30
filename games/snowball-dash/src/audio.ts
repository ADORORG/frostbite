import { commonEffects, tone, type Effect } from "@ador/game-sdk/audio/effects";
import type { Track } from "@ador/game-sdk/audio/tracks";

// Snowball Dash's sound, as data: a driving groove in D minor (a pulsing bass under a falling-snow tune; the page speeds it up as the
// slope does), and an effect for each thing that happens, with a shard that rings higher the longer the run of close calls. Nothing here is
// a file: the SDK plays it with the browser's audio.
const bass = [
  38,
  null,
  38,
  38,
  45,
  null,
  38,
  null,
  34,
  null,
  34,
  34,
  41,
  null,
  34,
  null,
];
const tune = [
  74,
  null,
  77,
  81,
  null,
  77,
  74,
  null,
  72,
  null,
  76,
  79,
  null,
  76,
  72,
  74,
];
const high = [
  86,
  null,
  null,
  null,
  89,
  null,
  null,
  null,
  84,
  null,
  null,
  null,
  88,
  null,
  null,
  null,
];

export const track: Track = {
  name: "snowball-dash",
  tempo: 140,
  voices: [
    { gain: 0.22, hold: 1.3, notes: bass, wave: "triangle" },
    { gain: 0.09, hold: 0.9, notes: tune, wave: "square" },
    { gain: 0.04, hold: 1.5, notes: high, wave: "sine" },
  ],
};

const shard = (pitch: number): Effect => [
  tone("square", pitch, pitch, 0.05, 0.22),
  tone("square", pitch * 1.5, pitch * 1.5, 0.12, 0.22, 0.05),
];

export const effects = {
  die: commonEffects.lose,
  fall: [tone("sawtooth", 500, 60, 0.6, 0.35)],
  hop: [tone("square", 300, 640, 0.12, 0.26)],
  land: [tone("noise", 0, 0, 0.05, 0.1)],
  level: commonEffects.good,
  milestone: commonEffects.win,
  near: [tone("triangle", 880, 1320, 0.1, 0.3)],
  shard0: shard(988),
  shard1: shard(1109),
  shard2: shard(1245),
  shard3: shard(1319),
  shard4: shard(1480),
  start: commonEffects.start,
} as const satisfies Record<string, Effect>;

export type EffectName = keyof typeof effects;
