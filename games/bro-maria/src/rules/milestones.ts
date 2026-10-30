import {
  levelTiles,
  lightningTicks,
  speed60Ticks,
  speedrunTicks,
  tile,
} from "./constants.ts";
import type { State } from "./types.ts";

// The marks a run earns, each decided by the state of the run alone. The words are in the manifest (`configs/games/bro-maria.ts`).
// The list is a draft for the owner to approve. Every level is laid out to have enough of everything (shards, slimes, crates) for every
// mark to be possible on every seed (`level.ts`).
export const coinsTaken = (state: State): number =>
  state.coinsTaken.filter(Boolean).length;

const finished = (state: State): boolean => state.finishTick !== null;
const finishedWithin = (state: State, ticks: number): boolean =>
  state.finishTick !== null && state.finishTick <= ticks;
const clean = (state: State): boolean => state.hits === 0 && state.deaths === 0;

const marks: readonly (readonly [string, (state: State) => boolean])[] = [
  // How far
  ["first-steps", (s) => s.farthest >= 10],
  ["tile-25", (s) => s.farthest >= 25],
  ["quarter-way", (s) => s.farthest >= levelTiles / 4],
  ["tile-75", (s) => s.farthest >= 75],
  ["halfway", (s) => s.checkpoint],
  ["tile-125", (s) => s.farthest >= 125],
  ["three-quarters", (s) => s.farthest >= (levelTiles * 3) / 4],
  ["tile-175", (s) => s.farthest >= 175],
  ["finish", finished],
  // Shards
  ["first-coin", (s) => coinsTaken(s) >= 1],
  ["coins-5", (s) => coinsTaken(s) >= 5],
  ["coins-10", (s) => coinsTaken(s) >= 10],
  ["coins-25", (s) => coinsTaken(s) >= 25],
  ["coins-40", (s) => coinsTaken(s) >= 40],
  ["coins-50", (s) => coinsTaken(s) >= 50],
  ["coins-65", (s) => coinsTaken(s) >= 65],
  // Slimes
  ["first-stomp", (s) => s.stomps >= 1],
  ["stomps-3", (s) => s.stomps >= 3],
  ["stomps-5", (s) => s.stomps >= 5],
  ["stomps-8", (s) => s.stomps >= 8],
  ["stomps-10", (s) => s.stomps >= 10],
  ["exterminator", (s) => s.stomps >= s.level.patrols.length],
  ["combo-2", (s) => s.bestCombo >= 2],
  ["combo-3", (s) => s.bestCombo >= 3],
  // Crates
  ["first-crate", (s) => s.crates >= 1],
  ["crates-3", (s) => s.crates >= 3],
  ["crates-5", (s) => s.crates >= 5],
  ["crates-8", (s) => s.crates >= 8],
  // How a level was finished
  ["untouched", (s) => finished(s) && clean(s)],
  ["pit-proof", (s) => finished(s) && s.deaths === 0],
  ["second-wind", (s) => finished(s) && s.deaths + s.hits >= 1],
  ["last-life", (s) => finished(s) && s.lives === 1],
  ["speed-60", (s) => finishedWithin(s, speed60Ticks)],
  ["speedrun", (s) => finishedWithin(s, speedrunTicks)],
  ["lightning", (s) => finishedWithin(s, lightningTicks)],
  ["pacifist", (s) => finished(s) && s.stomps === 0],
  ["collector", (s) => finished(s) && coinsTaken(s) === s.coinsTaken.length],
  [
    "all-rounder",
    (s) => finished(s) && coinsTaken(s) >= 25 && s.stomps >= 5 && s.crates >= 3,
  ],
  // A little of everything, and a good start
  [
    "tasting-menu",
    (s) => coinsTaken(s) >= 10 && s.stomps >= 1 && s.crates >= 1,
  ],
  ["clean-start", (s) => s.farthest >= 100 && clean(s)],
];

export const milestoneIds = marks.map(([id]) => id);

export const earnedBy = (state: State): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);

// The place of the lantern halfway, in tiles, for the screen.
export const checkpointTile = (state: State): number =>
  Math.floor(state.level.checkpointX / tile);
