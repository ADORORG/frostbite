import { ticksPerSecond } from "./constants.ts";
import { levelOf } from "./difficulty.ts";
import type { PermafrostState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones in
// the game's manifest, which holds their words. They are spread from the first clear to a run few will make.
const seconds = (n: number): number => n * ticksPerSecond;
const lines = (n: number) => (s: PermafrostState) => s.lines >= n;
const level = (n: number) => (s: PermafrostState) => levelOf(s.lines) >= n;
const score = (n: number) => (s: PermafrostState) => s.score >= n;

export const milestones: readonly (readonly [
  string,
  (state: PermafrostState) => boolean,
])[] = [
  ["first-line", lines(1)],
  ["lines-10", lines(10)],
  ["lines-25", lines(25)],
  ["lines-50", lines(50)],
  ["lines-100", lines(100)],
  ["lines-150", lines(150)],
  ["lines-200", lines(200)],
  ["level-3", level(3)],
  ["level-5", level(5)],
  ["level-10", level(10)],
  ["level-15", level(15)],
  ["level-20", level(20)],
  ["score-1k", score(1_000)],
  ["score-5k", score(5_000)],
  ["score-20k", score(20_000)],
  ["score-50k", score(50_000)],
  ["score-100k", score(100_000)],
  ["score-250k", score(250_000)],
  ["first-four", (s) => s.fours >= 1],
  ["fours-5", (s) => s.fours >= 5],
  ["fours-20", (s) => s.fours >= 20],
  ["combo-3", (s) => s.maxCombo >= 3],
  ["combo-6", (s) => s.maxCombo >= 6],
  ["combo-10", (s) => s.maxCombo >= 10],
  ["back-to-back", (s) => s.backToBackFours >= 1],
  ["back-to-back-5", (s) => s.backToBackFours >= 5],
  ["perfect-clear", (s) => s.perfectClears >= 1],
  ["sprint-3min", (s) => s.sprintTick !== null && s.sprintTick <= seconds(180)],
  ["sprint-90s", (s) => s.sprintTick !== null && s.sprintTick <= seconds(90)],
  ["no-hold-30", (s) => s.holdFreeLines >= 30],
  ["rising-10", (s) => s.garbageRows >= 10],
  ["rising-25", (s) => s.garbageRows >= 25],
];

export const milestoneIds: readonly string[] = milestones.map(([id]) => id);

export const earnedBy = (state: PermafrostState): readonly string[] =>
  milestones.filter(([, met]) => met(state)).map(([id]) => id);
