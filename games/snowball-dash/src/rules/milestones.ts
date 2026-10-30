import { baseSpeed, topSpeedBonus, unitsPerMetre } from "./constants.ts";
import { speedAt } from "./course.ts";
import type { SnowballState } from "./types.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones
// in the game's manifest, which holds their words.
export const metres = (state: SnowballState): number =>
  Math.floor(state.distance / unitsPerMetre);

interface Milestone {
  readonly id: string;
  readonly reached: (state: SnowballState) => boolean;
}

export const milestones: readonly Milestone[] = [
  { id: "first-hop", reached: (s) => s.hops >= 1 },
  { id: "rock-hopper", reached: (s) => s.cleared >= 5 },
  { id: "rock-master", reached: (s) => s.cleared >= 15 },
  { id: "hundred-metres", reached: (s) => metres(s) >= 100 },
  { id: "three-hundred-metres", reached: (s) => metres(s) >= 300 },
  { id: "close-shave", reached: (s) => s.closeCalls >= 1 },
  { id: "daredevil", reached: (s) => s.closeCalls >= 5 },
  {
    id: "full-speed",
    reached: (s) => speedAt(s.distance) >= baseSpeed + topSpeedBonus,
  },
  { id: "foot-of-the-slope", reached: (s) => s.finished },
  // A hop for every rock and no more: the snowball reaches the foot having hopped no more often than there are rocks.
  {
    id: "tidy-run",
    reached: (s) => s.finished && s.hops <= s.rocks.length,
  },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: SnowballState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
