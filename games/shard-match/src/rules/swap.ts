import {
  carryMoves,
  chainMoves,
  leftoverPoints,
  maxSwaps,
  starMoves,
} from "./constants.ts";
import { neighbour, runsOf } from "./board.ts";
import { swapped, withMove } from "./moves.ts";
import { resolve, type Resolved } from "./resolve.ts";
import {
  goalOf,
  kindsAt,
  movesFor,
  newLevel,
  type MatchState,
} from "./state.ts";

// Whether the goal of the level has been reached: the score made on it, or no frost left.
const reached = (
  level: number,
  levelScore: number,
  frost: readonly boolean[],
): boolean => {
  const goal = goalOf(level);
  return goal.kind === "score"
    ? levelScore >= goal.target
    : !frost.some(Boolean);
};

// What one swap that has played out does to the level: the frost its cleared cells break, the swaps spent and won, and then either the level is
// cleared (the leftover swaps are paid, some carry on, and a new board comes) or the same board goes on (shuffled if it has no swap left).
function afterSwap(
  state: MatchState,
  done: Resolved,
): Pick<
  MatchState,
  | "board"
  | "cause"
  | "ended"
  | "frost"
  | "frostBroken"
  | "level"
  | "levelCleared"
  | "levelScore"
  | "levelsCleared"
  | "moves"
  | "reshuffles"
  | "rng"
  | "score"
> {
  const broken = done.clearedCells.filter((cell) => state.frost[cell] === true);
  const frost = state.frost.map(
    (frosted, cell) => frosted && !broken.includes(cell),
  );
  const levelScore = state.levelScore + done.points;
  const moves =
    state.moves -
    1 +
    done.starsMade * starMoves +
    Math.max(0, done.depth - 2) * chainMoves;
  const common = {
    frostBroken: state.frostBroken + broken.length,
    reshuffles: state.reshuffles,
  };
  if (reached(state.level, levelScore, frost)) {
    const level = state.level + 1;
    const fresh = newLevel(level, done.rng);
    return {
      ...common,
      board: fresh.board,
      cause: null,
      ended: false,
      frost: fresh.frost,
      level,
      levelCleared: true,
      levelScore: 0,
      levelsCleared: state.levelsCleared + 1,
      moves: movesFor(level) + Math.min(carryMoves, Math.max(0, moves)),
      rng: fresh.rng,
      score:
        state.score +
        done.points +
        Math.max(0, moves) * leftoverPoints * state.level,
    };
  }
  const kept = withMove(done.board, done.rng, kindsAt(state.level));
  return {
    ...common,
    board: kept.board,
    cause: moves <= 0 ? "out" : null,
    ended: moves <= 0,
    frost,
    level: state.level,
    levelCleared: false,
    levelScore,
    levelsCleared: state.levelsCleared,
    moves,
    reshuffles: common.reshuffles + (kept.shuffled ? 1 : 0),
    rng: kept.state,
    score: state.score + done.points,
  };
}

// One swap of the shard in `cell` with its neighbour in `direction` (0 up, 1 right, 2 down, 3 left), or why it cannot be made. The swap must
// make a line. Everything it sets going is played out and then the level is reckoned (`afterSwap`). The run ends when the swaps of a level are
// used up before its goal is reached, or the record is full.
export function swapOnce(
  state: MatchState,
  cell: number,
  direction: number,
): MatchState | string {
  if (state.swaps >= maxSwaps) return "the run has made the most swaps it may";
  const other = neighbour(cell, direction);
  if (other < 0) return "that swap goes off the board";
  const after = swapped(state.board, cell, other);
  if (runsOf(after).length === 0) return "that swap makes no line";
  const done = resolve(after, [cell, other], kindsAt(state.level), state.rng);
  const next = afterSwap(state, done);
  const swaps = state.swaps + 1;
  const full = swaps >= maxSwaps;
  return {
    ...state,
    ...next,
    bestChain: Math.max(state.bestChain, done.depth),
    bestLine: Math.max(state.bestLine, done.longest),
    bestSwap: Math.max(state.bestSwap, done.points),
    bombsFired: state.bombsFired + done.bombsFired,
    bombsMade: state.bombsMade + done.bombsMade,
    cause: next.cause ?? (full ? "spent" : null),
    cleared: state.cleared + done.cleared,
    ended: next.ended || full,
    lastCleared: done.clearedCells,
    lastDepth: done.depth,
    lastGain: done.points,
    starsMade: state.starsMade + done.starsMade,
    swaps,
  };
}
