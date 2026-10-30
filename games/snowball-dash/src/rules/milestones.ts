import { baseSpeed, topSpeedBonus, unitsPerMetre } from "./constants.ts";
import { speedAt } from "./course.ts";
import type { SnowballState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones
// in the game's manifest, which holds their words. There are forty, in families: the first hop; rocks passed; every 25 metres of the
// slope; close calls (a rock cleared by at most `closeCallClearance`); and ways of reaching the foot.
export const metres = (state: SnowballState): number =>
  Math.floor(state.distance / unitsPerMetre);

interface Milestone {
  readonly id: string;
  readonly reached: (state: SnowballState) => boolean;
}

// The most rocks any slope is certain to have (`guaranteedRocks`) bounds the rock counts a milestone may ask for: a count above it would
// be out of reach on a slope with fewer.
export const rockMilestones: readonly (readonly [string, number])[] = [
  ["first-rock", 1],
  ["three-rocks", 3],
  ["rock-hopper", 5],
  ["eight-rocks", 8],
  ["ten-rocks", 10],
  ["twelve-rocks", 12],
  ["rock-master", 14],
];

export const closeCallMilestones: readonly (readonly [string, number])[] = [
  ["close-shave", 1],
  ["three-close", 3],
  ["daredevil", 5],
  ["eight-close", 8],
];

// A mark every 25 metres from 25 to 575. The 300 metre mark is where the snowball reaches its top speed, so that one is earned as
// "full-speed" and the ladder has no second milestone for the same moment.
export const markStep = 25;
export const lastMark = 575;
export const topSpeedMark = (topSpeedBonus * 1_000) / unitsPerMetre;
export const marks: readonly number[] = Array.from(
  { length: lastMark / markStep },
  (_, index) => (index + 1) * markStep,
);
export const markId = (mark: number): string =>
  mark === topSpeedMark ? "full-speed" : `metres-${String(mark)}`;

export const milestones: readonly Milestone[] = [
  { id: "first-hop", reached: (s) => s.hops >= 1 },
  ...rockMilestones.map(([id, count]) => ({
    id,
    reached: (s: SnowballState) => s.cleared >= count,
  })),
  ...marks.map((mark) => ({
    id: markId(mark),
    reached:
      mark === topSpeedMark
        ? (s: SnowballState) => speedAt(s.distance) >= baseSpeed + topSpeedBonus
        : (s: SnowballState) => metres(s) >= mark,
  })),
  ...closeCallMilestones.map(([id, count]) => ({
    id,
    reached: (s: SnowballState) => s.closeCalls >= count,
  })),
  { id: "foot-of-the-slope", reached: (s) => s.finished },
  // A hop for every rock and no more: the snowball reaches the foot having hopped no more often than there are rocks.
  {
    id: "tidy-run",
    reached: (s) => s.finished && s.hops <= s.rocks.length,
  },
  // The foot reached without once cutting a rock fine, and with the opposite: five, or eight, close calls on the way.
  {
    id: "comfortable-run",
    reached: (s) => s.finished && s.closeCalls === 0,
  },
  { id: "sharp-finish", reached: (s) => s.finished && s.closeCalls >= 5 },
  { id: "razor-finish", reached: (s) => s.finished && s.closeCalls >= 8 },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: SnowballState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
