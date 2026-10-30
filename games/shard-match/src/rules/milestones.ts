import type { MatchState } from "./state.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in the
// game's manifest, which holds their words. There are forty: the first swap, and ladders of score, level, the longest chain one swap set
// going, the longest line, bombs and stars made, bombs fired, shards cleared, the most one swap scored, and swaps made.
export interface Ladder {
  readonly of: (state: MatchState) => number;
  readonly prefix: string;
  readonly steps: readonly number[];
}

export const ladders: readonly Ladder[] = [
  {
    of: (s) => s.score,
    prefix: "score",
    steps: [1_000, 2_500, 5_000, 10_000, 20_000, 40_000, 80_000, 300_000],
  },
  { of: (s) => s.level, prefix: "level", steps: [2, 4, 6, 9, 13, 18] },
  { of: (s) => s.bestChain, prefix: "chain", steps: [2, 3, 4, 5, 7] },
  { of: (s) => s.bestLine, prefix: "line", steps: [4, 5, 6] },
  { of: (s) => s.bombsMade, prefix: "bombs", steps: [1, 6, 20] },
  { of: (s) => s.starsMade, prefix: "stars", steps: [1, 6] },
  { of: (s) => s.bombsFired, prefix: "blasts", steps: [1, 12] },
  { of: (s) => s.cleared, prefix: "shards", steps: [50, 200, 600, 1_500] },
  { of: (s) => s.bestSwap, prefix: "swap", steps: [200, 500, 1_000, 3_000] },
  { of: (s) => s.swaps, prefix: "swaps", steps: [40, 150] },
];

export const idOf = (prefix: string, step: number): string =>
  `${prefix}-${String(step)}`;

interface Milestone {
  readonly id: string;
  readonly reached: (state: MatchState) => boolean;
}

export const milestones: readonly Milestone[] = [
  { id: "first-swap", reached: (s) => s.swaps >= 1 },
  ...ladders.flatMap(({ of, prefix, steps }) =>
    steps.map((step) => ({
      id: idOf(prefix, step),
      reached: (s: MatchState) => of(s) >= step,
    })),
  ),
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: MatchState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
