import type { DropState } from "./state.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in the
// game's manifest, which holds their words.
interface Milestone {
  readonly id: string;
  readonly reached: (state: DropState) => boolean;
}

const atLeast =
  (read: (state: DropState) => number, goal: number) =>
  (state: DropState): boolean =>
    read(state) >= goal;
const tile = (value: number): ((state: DropState) => boolean) => {
  const level = Math.log2(value);
  return (state) => state.reachedAt[level] !== 0;
};

export const milestones: readonly Milestone[] = [
  { id: "tile-64", reached: tile(64) },
  { id: "tile-128", reached: tile(128) },
  { id: "tile-256", reached: tile(256) },
  { id: "tile-512", reached: tile(512) },
  { id: "tile-1024", reached: tile(1_024) },
  { id: "tile-2048", reached: tile(2_048) },
  { id: "tile-4096", reached: tile(4_096) },
  { id: "score-1k", reached: atLeast((s) => s.score, 1_000) },
  { id: "score-2500", reached: atLeast((s) => s.score, 2_500) },
  { id: "score-5k", reached: atLeast((s) => s.score, 5_000) },
  { id: "score-10k", reached: atLeast((s) => s.score, 10_000) },
  { id: "score-25k", reached: atLeast((s) => s.score, 25_000) },
  { id: "moves-100", reached: atLeast((s) => s.moves, 100) },
  { id: "moves-250", reached: atLeast((s) => s.moves, 250) },
  { id: "moves-500", reached: atLeast((s) => s.moves, 500) },
  { id: "moves-1000", reached: atLeast((s) => s.moves, 1_000) },
  { id: "double-up", reached: atLeast((s) => s.mostMerges, 2) },
  { id: "four-at-once", reached: atLeast((s) => s.mostMerges, 4) },
  { id: "avalanche", reached: atLeast((s) => s.mostMerges, 6) },
  { id: "on-a-roll", reached: atLeast((s) => s.bestStreak, 5) },
  { id: "hot-streak", reached: atLeast((s) => s.bestStreak, 10) },
  { id: "unbreakable", reached: atLeast((s) => s.bestStreak, 20) },
  { id: "corner-king", reached: (s) => s.cornerKing },
  { id: "spacious", reached: (s) => s.spacious },
  { id: "close-shave", reached: (s) => s.closeShave },
  {
    id: "quick-128",
    reached: (s) => s.reachedAt[7] !== 0 && (s.reachedAt[7] ?? 0) <= 100,
  },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: DropState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
