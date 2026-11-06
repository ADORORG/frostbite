import { commonEffects, tone } from "@frostbite/game-sdk/audio/effects";
import type { Track } from "@frostbite/game-sdk/audio/tracks";

// Aurora Pulse's sound, as data: a steady pulse (a step is half a beat, and the tempo is the chart's, 32 ticks to a beat) of a low bass, a bright
// arpeggio and a high shimmer in A minor, and an effect for each thing that happens: each lane taps in a note of its own (a pentatonic run, so any
// taps sound well together), a perfect tap adds a glint, and a miss is a dull thud. Nothing here is a file: the SDK plays it with the browser's audio.
const bass = [
  45,
  null,
  45,
  null,
  45,
  null,
  52,
  null,
  43,
  null,
  43,
  null,
  43,
  null,
  50,
  null,
];
const arp = [69, 72, 76, 72, 69, 72, 76, 81, 67, 71, 74, 71, 67, 71, 74, 79];
const shimmer = [
  93,
  null,
  null,
  null,
  96,
  null,
  null,
  null,
  91,
  null,
  null,
  null,
  95,
  null,
  null,
  null,
];

export const track: Track = {
  name: "aurora-pulse",
  tempo: 112.5,
  voices: [
    { gain: 0.2, hold: 1.5, notes: bass, wave: "triangle" },
    { gain: 0.06, hold: 0.8, notes: arp, wave: "sine" },
    { gain: 0.03, hold: 2, notes: shimmer, wave: "sine" },
  ],
};

const tap = (pitch: number) => [tone("triangle", pitch, pitch, 0.12, 0.3)];

export const effects = {
  glint: [tone("sine", 1760, 2640, 0.1, 0.12)],
  lane0: tap(523),
  lane1: tap(659),
  lane2: tap(784),
  lane3: tap(880),
  lose: commonEffects.lose,
  milestone: commonEffects.win,
  miss: [tone("triangle", 140, 90, 0.12, 0.25)],
  stage: commonEffects.good,
  start: commonEffects.start,
  stray: [tone("noise", 0, 0, 0.04, 0.1)],
  win: commonEffects.win,
} as const;

export type EffectName = keyof typeof effects;
