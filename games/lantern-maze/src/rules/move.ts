import {
  flaskPoints,
  floorPoints,
  lastFloor,
  leanPercent,
  maxMoves,
  speedPoints,
} from "./constants.ts";
import { lightAround } from "./light.ts";
import { cellOpen, neighbour } from "./maze.ts";
import { enterFloor, type MazeState } from "./state.ts";

// Clears the floor the lantern stands on (it holds the key and is at the door): the points, and the next floor with the oil it comes with,
// or the end of the run if that was the last.
function clear(state: MazeState): MazeState {
  const { layout, stepsHere } = state;
  const lean = stepsHere * 100 <= layout.shortest * leanPercent;
  const leanStreak = lean ? state.leanStreak + 1 : 0;
  const cleared = {
    bestLeanStreak: Math.max(state.bestLeanStreak, leanStreak),
    flawless: state.flawless + (stepsHere === layout.shortest ? 1 : 0),
    floorsCleared: state.floorsCleared + 1,
    fullFloors: state.fullFloors + (state.flasks.length === 0 ? 1 : 0),
    lean: state.lean + (lean ? 1 : 0),
    leanStreak,
    score:
      state.score +
      floorPoints * state.floor +
      speedPoints * Math.max(0, 2 * layout.shortest - stepsHere),
  };
  if (state.floor >= lastFloor)
    return { ...state, ...cleared, cause: "escaped", ended: true };
  const next = enterFloor(state, state.floor + 1);
  const oil = state.oil + next.layout.entry;
  return {
    ...state,
    ...cleared,
    ...next,
    oil,
    peakOil: Math.max(state.peakOil, oil),
  };
}

// One step in `direction` (0 up, 1 right, 2 down, 3 left), or why it cannot be taken. A step burns one oil; it may pick up a flask or
// the key; reaching the door with the key clears the floor; and a lantern with no oil left is out, which ends the run.
export function stepOnce(
  state: MazeState,
  direction: number,
): MazeState | string {
  if (state.moves >= maxMoves) return "the run has made the most moves it may";
  if (!cellOpen(state.layout.maze, state.position, direction))
    return "a wall is there";
  const { maze } = state.layout;
  const position = neighbour(
    maze.width,
    maze.height,
    state.position,
    direction,
  );
  const flask = state.flasks.includes(position);
  const oil = state.oil - 1 + (flask ? state.layout.flaskValue : 0);
  const moved: MazeState = {
    ...state,
    flasks: flask
      ? state.flasks.filter((cell) => cell !== position)
      : state.flasks,
    flasksTaken: state.flasksTaken + (flask ? 1 : 0),
    hasKey: state.hasKey || position === state.layout.key,
    moves: state.moves + 1,
    oil,
    peakOil: Math.max(state.peakOil, oil),
    position,
    score: state.score + (flask ? flaskPoints : 0),
    seen: lightAround(maze, state.seen, position, state.layout.sight),
    stepsHere: state.stepsHere + 1,
  };
  if (moved.hasKey && position === state.layout.door) return clear(moved);
  if (oil <= 0) return { ...moved, cause: "dark", ended: true };
  return moved.moves >= maxMoves
    ? { ...moved, cause: "spent", ended: true }
    : moved;
}
