import type { MazeState } from "./state.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in the
// game's manifest, which holds their words. There are forty: the first step, and ladders of floors cleared, flasks taken, floors cleared
// lean (in at most 130% of the shortest route), floors cleared with every flask, runs of lean floors, floors cleared without a wrong turn,
// the most oil held at once, steps, and score.
export interface Ladder {
  readonly of: (state: MazeState) => number;
  readonly prefix: string;
  readonly steps: readonly number[];
}

export const ladders: readonly Ladder[] = [
  {
    of: (s) => s.floorsCleared,
    prefix: "floors",
    steps: [1, 3, 5, 8, 12, 16, 20, 25, 30],
  },
  { of: (s) => s.flasksTaken, prefix: "flasks", steps: [5, 15, 30, 60, 100] },
  { of: (s) => s.lean, prefix: "lean", steps: [1, 3, 6, 10, 15] },
  { of: (s) => s.flawless, prefix: "flawless", steps: [1, 3] },
  { of: (s) => s.fullFloors, prefix: "sweep", steps: [1, 3, 6] },
  { of: (s) => s.bestLeanStreak, prefix: "streak", steps: [2, 4, 6] },
  { of: (s) => s.peakOil, prefix: "oil", steps: [200, 250, 300, 400] },
  { of: (s) => s.moves, prefix: "steps", steps: [300, 1_000] },
  {
    of: (s) => s.score,
    prefix: "score",
    steps: [1_500, 4_000, 8_000, 15_000, 30_000, 50_000],
  },
];

export const idOf = (prefix: string, step: number): string =>
  `${prefix}-${String(step)}`;

interface Milestone {
  readonly id: string;
  readonly reached: (state: MazeState) => boolean;
}

export const milestones: readonly Milestone[] = [
  { id: "first-step", reached: (s) => s.moves >= 1 },
  ...ladders.flatMap(({ of, prefix, steps }) =>
    steps.map((step) => ({
      id: idOf(prefix, step),
      reached: (s: MazeState) => of(s) >= step,
    })),
  ),
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: MazeState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
