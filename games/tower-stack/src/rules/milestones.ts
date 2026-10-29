import type { TowerState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in
// the game's manifest, which holds their words.
interface Milestone {
  readonly id: string;
  readonly reached: (state: TowerState) => boolean;
}

const atLeast =
  (read: (state: TowerState) => number, goal: number) =>
  (state: TowerState): boolean =>
    read(state) >= goal;
const height = (state: TowerState): number => state.height;
const perfects = (state: TowerState): number => state.perfects;
const streak = (state: TowerState): number => state.bestStreak;

export const milestones: readonly Milestone[] = [
  { id: "first-block", reached: atLeast(height, 1) },
  { id: "ten-high", reached: atLeast(height, 10) },
  { id: "quarter-hundred", reached: atLeast(height, 25) },
  { id: "fifty-high", reached: atLeast(height, 50) },
  { id: "century", reached: atLeast(height, 100) },
  { id: "skyline", reached: atLeast(height, 200) },
  { id: "first-perfect", reached: atLeast(perfects, 1) },
  { id: "perfect-ten", reached: atLeast(perfects, 10) },
  { id: "perfect-fifty", reached: atLeast(perfects, 50) },
  { id: "triple", reached: atLeast(streak, 3) },
  { id: "five-streak", reached: atLeast(streak, 5) },
  { id: "ten-streak", reached: atLeast(streak, 10) },
  { id: "twenty-streak", reached: atLeast(streak, 20) },
  { id: "double-five", reached: atLeast((s) => s.fives, 2) },
  { id: "regrown", reached: (s) => s.regrown },
  { id: "needle", reached: (s) => s.needle },
  { id: "wide-load", reached: (s) => s.wideLoad },
  { id: "tidy-tower", reached: (s) => s.tidy },
  { id: "by-a-hair", reached: (s) => s.byHair },
  { id: "marathon", reached: (s) => s.marathon },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: TowerState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
