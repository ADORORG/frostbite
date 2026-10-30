import { subPerMetre } from "./constants.ts";
import type { RunState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in the
// game's manifest, which holds their words. There are forty: the first hop, and ladders of score, distance, how high a hop went, how long one lasted, shards, obstacles
// cleared (all, then by kind), close calls in a row, and close calls in all. The early rungs come in the first minutes; the top ones take
// many runs.
export interface Ladder {
  readonly of: (state: RunState) => number;
  readonly prefix: string;
  readonly steps: readonly number[];
}

const totalCleared = (state: RunState): number =>
  state.cleared.rock +
  state.cleared.boulder +
  state.cleared.pit +
  state.cleared.spikes;

export const ladders: readonly Ladder[] = [
  {
    of: (s) => s.score,
    prefix: "score",
    steps: [500, 1_500, 3_000, 6_000, 12_000, 25_000, 50_000, 100_000],
  },
  {
    of: (s) => Math.floor(s.distance / subPerMetre),
    prefix: "metres",
    steps: [100, 250, 500, 800, 1_200, 2_000],
  },
  { of: (s) => s.peak, prefix: "height", steps: [120, 200, 270] },
  { of: (s) => s.longest, prefix: "airtime", steps: [24, 36, 48] },
  { of: (s) => s.shardsTaken, prefix: "shards", steps: [10, 25, 50, 100, 200] },
  { of: totalCleared, prefix: "clears", steps: [10, 25, 50, 100] },
  { of: (s) => s.cleared.boulder, prefix: "boulders", steps: [10, 25] },
  { of: (s) => s.cleared.pit, prefix: "pits", steps: [10, 25] },
  { of: (s) => s.cleared.spikes, prefix: "spikes", steps: [10, 25] },
  { of: (s) => s.bestStreak, prefix: "streak", steps: [2, 4, 6] },
  { of: (s) => s.closeCalls, prefix: "close", steps: [25] },
];

export const idOf = (prefix: string, step: number): string =>
  `${prefix}-${String(step)}`;

interface Milestone {
  readonly id: string;
  readonly reached: (state: RunState) => boolean;
}

export const milestones: readonly Milestone[] = [
  { id: "first-hop", reached: (s) => s.hops >= 1 },
  ...ladders.flatMap(({ of, prefix, steps }) =>
    steps.map((step) => ({
      id: idOf(prefix, step),
      reached: (s: RunState) => of(s) >= step,
    })),
  ),
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: RunState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
