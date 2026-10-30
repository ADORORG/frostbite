import {
  lightningTicks,
  maxLives,
  stages,
  swiftTicks,
  tile,
} from "./constants.ts";
import type { State } from "./types.ts";

// The marks a run earns, each decided by the state of the run alone. The words are in the manifest (`configs/games/bro-maria.ts`). The list is
// a draft for the owner to approve. A run is `stages` stages, so the counts (shards, slimes, crates) are for the whole run, and the marks about
// how a stage was played count the stages that were played that way. Every stage is laid out to have enough of everything (shards, slimes,
// crates) for every mark to be possible on every seed (`level.ts`).
export const coinsTaken = (state: State): number =>
  state.coinsBanked + state.coinsTaken.filter(Boolean).length;

const finished = (state: State): boolean => state.finishTick !== null;

const marks: readonly (readonly [string, (state: State) => boolean])[] = [
  // How far
  ["first-steps", (s) => s.stage > 1 || s.farthest >= 10],
  ["tile-100", (s) => s.stage > 1 || s.farthest >= 100],
  ["halfway", (s) => s.stage > 1 || s.checkpoint],
  ["stage-2", (s) => s.stagesCleared >= 1],
  ["stage-3", (s) => s.stagesCleared >= 2],
  ["stage-4", (s) => s.stagesCleared >= 3],
  ["stage-5", (s) => s.stagesCleared >= 4],
  ["stage-6", (s) => s.stagesCleared >= 5],
  ["finish", finished],
  // Shards
  ["first-coin", (s) => coinsTaken(s) >= 1],
  ["coins-10", (s) => coinsTaken(s) >= 10],
  ["coins-25", (s) => coinsTaken(s) >= 25],
  ["coins-50", (s) => coinsTaken(s) >= 50],
  ["coins-100", (s) => coinsTaken(s) >= 100],
  ["coins-175", (s) => coinsTaken(s) >= 175],
  ["coins-250", (s) => coinsTaken(s) >= 250],
  // Slimes
  ["first-stomp", (s) => s.stomps >= 1],
  ["stomps-5", (s) => s.stomps >= 5],
  ["stomps-10", (s) => s.stomps >= 10],
  ["stomps-20", (s) => s.stomps >= 20],
  ["stomps-40", (s) => s.stomps >= 40],
  ["stomps-70", (s) => s.stomps >= 70],
  ["stomps-100", (s) => s.stomps >= 100],
  ["combo-2", (s) => s.bestCombo >= 2],
  ["combo-3", (s) => s.bestCombo >= 3],
  // Crates
  ["first-crate", (s) => s.crates >= 1],
  ["crates-5", (s) => s.crates >= 5],
  ["crates-12", (s) => s.crates >= 12],
  ["crates-24", (s) => s.crates >= 24],
  // How the stages were played
  ["clean-stage", (s) => s.cleanStages >= 1],
  ["clean-stages-3", (s) => s.cleanStages >= 3],
  ["flawless", (s) => finished(s) && s.cleanStages >= stages],
  ["pit-proof", (s) => finished(s) && s.deaths === 0],
  ["last-life", (s) => finished(s) && s.lives === 1],
  ["five-lives", (s) => s.lives >= maxLives],
  ["swift", (s) => s.fastest <= swiftTicks],
  ["lightning", (s) => s.fastest <= lightningTicks],
  ["collector", (s) => s.perfectStages >= 1],
  ["collector-3", (s) => s.perfectStages >= 3],
  [
    "tasting-menu",
    (s) => coinsTaken(s) >= 10 && s.stomps >= 1 && s.crates >= 1,
  ],
];

export const milestoneIds = marks.map(([id]) => id);

export const earnedBy = (state: State): readonly string[] =>
  marks.filter(([, earned]) => earned(state)).map(([id]) => id);

// The place of the lantern halfway, in tiles, for the screen.
export const checkpointTile = (state: State): number =>
  Math.floor(state.level.checkpointX / tile);
