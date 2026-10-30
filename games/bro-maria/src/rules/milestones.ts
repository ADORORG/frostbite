import { levelTiles, speedrunTicks, tile } from "./constants.ts";
import type { State } from "./types.ts";

// The marks a run earns, each decided by the state of the run alone. The words are in the manifest (`configs/games/bro-maria.ts`).
// The list is a draft for the owner to approve.
export const milestoneIds = [
  "first-steps",
  "quarter-way",
  "halfway",
  "three-quarters",
  "finish",
  "first-coin",
  "coins-10",
  "coins-25",
  "coins-50",
  "first-stomp",
  "stomps-5",
  "stomps-10",
  "combo-3",
  "first-crate",
  "crates-5",
  "untouched",
  "speedrun",
  "pacifist",
  "collector",
  "last-life",
] as const;

export type MilestoneId = (typeof milestoneIds)[number];

export const coinsTaken = (state: State): number =>
  state.coinsTaken.filter(Boolean).length;

export function earnedBy(state: State): readonly string[] {
  const coins = coinsTaken(state);
  const finished = state.finishTick !== null;
  const reached: readonly [MilestoneId, boolean][] = [
    ["first-steps", state.farthest >= 10],
    ["quarter-way", state.farthest >= levelTiles / 4],
    ["halfway", state.checkpoint],
    ["three-quarters", state.farthest >= (levelTiles * 3) / 4],
    ["finish", finished],
    ["first-coin", coins >= 1],
    ["coins-10", coins >= 10],
    ["coins-25", coins >= 25],
    ["coins-50", coins >= 50],
    ["first-stomp", state.stomps >= 1],
    ["stomps-5", state.stomps >= 5],
    ["stomps-10", state.stomps >= 10],
    ["combo-3", state.bestCombo >= 3],
    ["first-crate", state.crates >= 1],
    ["crates-5", state.crates >= 5],
    ["untouched", finished && state.hits === 0 && state.deaths === 0],
    ["speedrun", finished && (state.finishTick ?? Infinity) <= speedrunTicks],
    ["pacifist", finished && state.stomps === 0],
    ["collector", finished && coins === state.coinsTaken.length],
    ["last-life", finished && state.lives === 1],
  ];
  return reached.filter(([, earned]) => earned).map(([id]) => id);
}

// The place of the lantern halfway, in tiles, for the screen.
export const checkpointTile = (state: State): number =>
  Math.floor(state.level.checkpointX / tile);
