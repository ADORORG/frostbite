import { startPercent } from "./constants.ts";
import { buildFloor, type Floor } from "./floor.ts";
import { lightAround } from "./light.ts";

// A run of LANTERN MAZE at one moment. The numbers that decide milestones are kept here as running counts, so a milestone is a question
// about a state and nothing else.
export interface MazeState {
  // Set when the oil is gone ("dark"), the last floor is cleared ("escaped"), or the run has made the most steps a record may hold ("spent").
  readonly cause: "dark" | "escaped" | "spent" | null;
  readonly ended: boolean;
  readonly flasksTaken: number;
  // Floors cleared with every flask on them taken.
  readonly fullFloors: number;
  readonly floor: number;
  readonly floorsCleared: number;
  readonly flawless: number;
  readonly hasKey: boolean;
  // The cells that still hold a flask.
  readonly flasks: readonly number[];
  readonly layout: Floor;
  readonly lean: number;
  readonly leanStreak: number;
  readonly bestLeanStreak: number;
  readonly moves: number;
  readonly oil: number;
  readonly peakOil: number;
  readonly score: number;
  readonly seed: number;
  // For each cell, whether the lantern has lit it.
  readonly seen: readonly boolean[];
  readonly position: number;
  // Steps taken on this floor.
  readonly stepsHere: number;
}

export function enterFloor(
  state: Pick<MazeState, "seed">,
  floor: number,
): Pick<
  MazeState,
  "flasks" | "floor" | "hasKey" | "layout" | "position" | "seen" | "stepsHere"
> {
  const layout = buildFloor(state.seed, floor);
  const blank = new Array<boolean>(layout.maze.open.length).fill(false);
  return {
    flasks: layout.flasks,
    floor,
    hasKey: false,
    layout,
    position: 0,
    seen: lightAround(layout.maze, blank, 0, layout.sight),
    stepsHere: 0,
  };
}

export function startRun(seed: number): MazeState {
  const first = enterFloor({ seed }, 1);
  const oil = Math.ceil((first.layout.shortest * startPercent) / 100);
  return {
    bestLeanStreak: 0,
    cause: null,
    ended: false,
    flasksTaken: 0,
    flawless: 0,
    floorsCleared: 0,
    fullFloors: 0,
    lean: 0,
    leanStreak: 0,
    moves: 0,
    oil,
    peakOil: oil,
    score: 0,
    seed,
    ...first,
  };
}
