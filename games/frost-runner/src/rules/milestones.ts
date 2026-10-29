import { ticksPerSecond, unitsPerMetre } from "./constants.ts";
import type { RunnerState } from "./types.ts";
import { speedAt } from "./world.ts";
import { topSpeedBonus, baseSpeed } from "./constants.ts";

// Every milestone this game can earn, each decided by the state of a run alone (so a replay can decide it too). The ids are the ones
// in the game's manifest, which holds their words.
export const metres = (state: RunnerState): number =>
  Math.floor(state.distance / unitsPerMetre);

interface Milestone {
  readonly id: string;
  readonly reached: (state: RunnerState) => boolean;
}

const atLeast =
  (read: (state: RunnerState) => number, goal: number) =>
  (state: RunnerState): boolean =>
    read(state) >= goal;

export const milestones: readonly Milestone[] = [
  { id: "first-steps", reached: atLeast(metres, 100) },
  { id: "quarter-km", reached: atLeast(metres, 250) },
  { id: "half-km", reached: atLeast(metres, 500) },
  { id: "one-km", reached: atLeast(metres, 1_000) },
  { id: "two-km", reached: atLeast(metres, 2_000) },
  { id: "three-km", reached: atLeast(metres, 3_000) },
  { id: "shard-10", reached: atLeast((s) => s.shardsTaken, 10) },
  { id: "shard-50", reached: atLeast((s) => s.shardsTaken, 50) },
  { id: "shard-100", reached: atLeast((s) => s.shardsTaken, 100) },
  { id: "shard-250", reached: atLeast((s) => s.shardsTaken, 250) },
  { id: "sky-picker", reached: atLeast((s) => s.highShards, 10) },
  { id: "hurdler", reached: atLeast((s) => s.cleared, 10) },
  { id: "steeplechase", reached: atLeast((s) => s.cleared, 50) },
  { id: "obstacle-course", reached: atLeast((s) => s.cleared, 100) },
  { id: "unstoppable", reached: atLeast((s) => s.cleared, 200) },
  { id: "close-call", reached: atLeast((s) => s.closeCalls, 1) },
  { id: "daredevil", reached: atLeast((s) => s.closeCalls, 10) },
  { id: "thread-the-needle", reached: atLeast((s) => s.closeCalls, 25) },
  { id: "leap-of-faith", reached: atLeast((s) => s.jumps, 25) },
  { id: "limbo", reached: atLeast((s) => s.slides, 25) },
  { id: "acrobat", reached: (s) => s.jumps >= 40 && s.slides >= 40 },
  { id: "minute-man", reached: atLeast((s) => s.tick, 60 * ticksPerSecond) },
  {
    id: "blizzard-pace",
    reached: (s) => speedAt(s.distance) >= baseSpeed + topSpeedBonus,
  },
];

export const milestoneIds: readonly string[] = milestones.map(({ id }) => id);

export function earnedBy(state: RunnerState): readonly string[] {
  return milestones.filter(({ reached }) => reached(state)).map(({ id }) => id);
}
