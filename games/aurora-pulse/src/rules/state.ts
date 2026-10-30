import { startMaker, type Maker, type Note } from "./chart.ts";
import { leadTicks, stageTicks, startEnergy } from "./constants.ts";

// What the last tap was judged as, and when, for the screen to show. It is part of the state but no rule reads it.
export interface Judged {
  readonly kind: "good" | "great" | "miss" | "perfect" | "stray";
  readonly lane: number;
  readonly tick: number;
}

// A run of AURORA PULSE at one moment. The numbers that decide milestones are running counts, so a milestone is a question about a state and
// nothing else.
export interface PulseState {
  readonly bestCombo: number;
  readonly bestPerfects: number;
  // Bars played from the first note to the last, each without a miss or a stray tap.
  readonly cleanBars: number;
  readonly cause: "faded" | "finished" | "spent" | null;
  readonly combo: number;
  readonly ended: boolean;
  readonly energy: number;
  // Whether a miss or a stray tap has come in the bar being played.
  readonly flawed: boolean;
  readonly goods: number;
  readonly greats: number;
  // Taps judged a hit (perfect, great or good), and the taps made in all (hits and strays), which a record is limited in.
  readonly hits: number;
  readonly inputs: number;
  readonly judged: Judged | null;
  // The bar about to be made, and the generator that makes it.
  readonly maker: Maker;
  readonly misses: number;
  readonly nextBar: number;
  // The notes made and not yet tapped or missed.
  readonly pending: readonly Note[];
  readonly peakEnergy: number;
  readonly perfectRun: number;
  readonly perfects: number;
  readonly score: number;
  readonly strays: number;
  readonly tick: number;
}

export const stageAt = (tick: number): number =>
  Math.floor(Math.max(0, tick - leadTicks) / stageTicks) + 1;

export const startRun = (seed: number): PulseState => ({
  bestCombo: 0,
  bestPerfects: 0,
  cause: null,
  cleanBars: 0,
  combo: 0,
  ended: false,
  energy: startEnergy,
  flawed: false,
  goods: 0,
  greats: 0,
  hits: 0,
  inputs: 0,
  judged: null,
  maker: startMaker(seed),
  misses: 0,
  nextBar: 0,
  pending: [],
  peakEnergy: startEnergy,
  perfectRun: 0,
  perfects: 0,
  score: 0,
  strays: 0,
  tick: 0,
});
