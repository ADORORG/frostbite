import { sharedMarks } from "../shared-marks.ts";
import type { HillsState } from "./types.ts";

// The marks a run of Egg Hills earns, each decided by the state of the run alone. Their words are in the manifest
// (`configs/games/pocket-dragon.ts`); the list is a draft for the owner to approve. Every stage has enough eggs, gloomlings and ice for
// each mark to be possible (`level.ts`). Eggs freed from the egg rocket count as eggs caught.
export const eggsCaught = (state: HillsState): number =>
  state.eggsBanked + state.eggsTaken.filter(Boolean).length + state.freedCaught;

export const plasmaGathered = (state: HillsState): number =>
  state.plasmaBanked + state.plasma.gathered;

const finished = (state: HillsState): boolean => state.finishTick !== null;

const marks: readonly (readonly [string, (state: HillsState) => boolean])[] = [
  ["first-egg", (s) => eggsCaught(s) >= 1],
  ["eggs-60", (s) => eggsCaught(s) >= 60],
  ["golden-egg", (s) => s.goldens >= 1],
  ["golden-eggs-3", (s) => s.goldens >= 3],
  ["fire-breath", (s) => s.breaths >= 1],
  ["ice-melter", (s) => s.meltedCount >= 15],
  ["cheer-5", (s) => s.cheers >= 5],
  ["hills-clear", finished],
  ["hills-no-bumps", (s) => finished(s) && s.heartsLost === 0],
  ["hills-guards", (s) => s.guardsCheered >= 4],
  ["hills-rocket-eggs", (s) => s.freedCaught >= 10],
  ...sharedMarks<HillsState>((s) => s.charms, plasmaGathered),
];

export const hillsMilestones = marks.map(([id]) => id);

export const hillsEarned = (state: HillsState): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);
