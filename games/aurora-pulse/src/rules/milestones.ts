import { maxEnergy } from "./constants.ts";
import { stageAt, type PulseState } from "./state.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in the
// game's manifest, which holds their words. There are forty: the first hit, and ladders of score, the longest combo, perfect hits, the stage
// reached, hits, bars played clean, perfects in a row, and two marks (the aurora at full light, and the whole track played out).
export interface Ladder {
  readonly of: (state: PulseState) => number;
  readonly prefix: string;
  readonly steps: readonly number[];
}

export const ladders: readonly Ladder[] = [
  {
    of: (s) => s.score,
    prefix: "score",
    steps: [5_000, 15_000, 40_000, 100_000, 250_000, 600_000, 1_500_000],
  },
  {
    of: (s) => s.bestCombo,
    prefix: "combo",
    steps: [10, 25, 50, 100, 200, 400, 800],
  },
  { of: (s) => s.perfects, prefix: "perfects", steps: [25, 100, 300, 800] },
  {
    of: (s) => stageAt(s.tick),
    prefix: "stage",
    steps: [2, 4, 6, 9, 12, 16, 20],
  },
  { of: (s) => s.hits, prefix: "hits", steps: [50, 200, 600, 1_500] },
  { of: (s) => s.cleanBars, prefix: "clean", steps: [3, 8, 20, 50] },
  { of: (s) => s.bestPerfects, prefix: "streak", steps: [5, 15, 40, 100] },
];

export const idOf = (prefix: string, step: number): string =>
  `${prefix}-${String(step)}`;

interface Milestone {
  readonly id: string;
  readonly reached: (state: PulseState) => boolean;
}

export const milestones: readonly Milestone[] = [
  { id: "first-hit", reached: (s) => s.hits >= 1 },
  ...ladders.flatMap(({ of, prefix, steps }) =>
    steps.map((step) => ({
      id: idOf(prefix, step),
      reached: (s: PulseState) => of(s) >= step,
    })),
  ),
  { id: "full-light", reached: (s) => s.peakEnergy >= maxEnergy },
  { id: "full-set", reached: (s) => s.cause === "finished" },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: PulseState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
