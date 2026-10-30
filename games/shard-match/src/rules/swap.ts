import { chainMoves, levelMoves, maxSwaps, starMoves } from "./constants.ts";
import { neighbour, runsOf } from "./board.ts";
import { freshBoard, hasMove, swapped } from "./moves.ts";
import { resolve } from "./resolve.ts";
import { kindsAt, targetOf, type MatchState } from "./state.ts";

// One swap of the shard in `cell` with its neighbour in `direction` (0 up, 1 right, 2 down, 3 left), or why it cannot be made. The swap must
// make a line. Everything it sets going is played out, the score and the moves are reckoned, the level goes up if the score has reached its
// target, and a board with no swap left is shuffled. The run ends when no swap is left to make.
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
  const score = state.score + done.points;
  let level = state.level;
  let moves =
    state.moves -
    1 +
    done.starsMade * starMoves +
    Math.max(0, done.depth - 2) * chainMoves;
  while (score >= targetOf(level)) {
    level += 1;
    moves += levelMoves;
  }
  let board = done.board;
  let rng = done.rng;
  let reshuffles = state.reshuffles;
  if (!hasMove(board)) {
    const fresh = freshBoard(rng, kindsAt(level));
    board = fresh.board;
    rng = fresh.state;
    reshuffles += 1;
  }
  const swaps = state.swaps + 1;
  return {
    ...state,
    bestChain: Math.max(state.bestChain, done.depth),
    bestLine: Math.max(state.bestLine, done.longest),
    bestSwap: Math.max(state.bestSwap, done.points),
    board,
    bombsFired: state.bombsFired + done.bombsFired,
    bombsMade: state.bombsMade + done.bombsMade,
    cause: moves <= 0 ? "out" : swaps >= maxSwaps ? "spent" : null,
    cleared: state.cleared + done.cleared,
    ended: moves <= 0 || swaps >= maxSwaps,
    lastCleared: done.clearedCells,
    lastDepth: done.depth,
    lastGain: done.points,
    level,
    moves,
    reshuffles,
    rng,
    score,
    starsMade: state.starsMade + done.starsMade,
    swaps,
  };
}
