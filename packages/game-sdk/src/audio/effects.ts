import type { Wave } from "./tracks.ts";

// A sound effect as data: one or more tones, each a pitch that glides from one frequency to another (or noise), starting `at`
// seconds in. A jump is a tone rising; a coin is two; a crash is noise. Games name their own effects.
export interface Tone {
  readonly at: number;
  readonly from: number;
  readonly gain: number;
  readonly seconds: number;
  readonly to: number;
  readonly wave: Wave | "noise";
}

export type Effect = readonly Tone[];

export const tone = (
  wave: Tone["wave"],
  from: number,
  to: number,
  seconds: number,
  gain = 0.5,
  at = 0,
): Tone => ({ at, from, gain, seconds, to, wave });

// Shared effects most games want, so each does not invent its own: a press on a button, a good thing, a bad thing.
export const commonEffects = {
  click: [tone("square", 520, 760, 0.06, 0.3)],
  good: [
    tone("square", 660, 990, 0.09, 0.35),
    tone("square", 990, 1320, 0.12, 0.35, 0.08),
  ],
  lose: [
    tone("sawtooth", 330, 110, 0.5, 0.4),
    tone("noise", 0, 0, 0.3, 0.25, 0.05),
  ],
  start: [
    tone("square", 392, 392, 0.08, 0.35),
    tone("square", 523, 523, 0.08, 0.35, 0.09),
    tone("square", 784, 784, 0.16, 0.35, 0.18),
  ],
  win: [
    tone("square", 523, 523, 0.1, 0.35),
    tone("square", 659, 659, 0.1, 0.35, 0.1),
    tone("square", 784, 784, 0.1, 0.35, 0.2),
    tone("square", 1047, 1047, 0.3, 0.35, 0.3),
  ],
} as const satisfies Record<string, Effect>;
