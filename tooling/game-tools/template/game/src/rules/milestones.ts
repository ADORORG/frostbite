import type { StarterState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in
// the game's manifest, which holds their words.
export const milestones = [
  { id: "first-catch", score: 1 },
  { id: "first-five", score: 5 },
  { id: "ten-catches", score: 10 },
  { id: "twenty-five", score: 25 },
] as const;

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export const earnedBy = (state: StarterState): readonly string[] =>
  milestones.filter(({ score }) => state.score >= score).map(({ id }) => id);
