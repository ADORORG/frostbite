import { maxMoves, type Direction } from "./constants.ts";
import { canMove, emptyCells, highest, inCorner, slide } from "./board.ts";
import { spawn, type DropState } from "./state.ts";

const cornerLevel = 8;
const spaciousLevel = 7;
const spaciousEmpty = 8;

// One move. It must change the board (a move that does nothing is refused by the caller); then a new tile appears, and everything the
// milestones look at is brought up to date: the score, the levels reached, the streak of moves that joined tiles, and the marks.
export function moveOnce(
  state: DropState,
  direction: Direction,
): DropState | null {
  const slid = slide(state.board, direction);
  if (!slid.moved) return null;
  const placed = spawn(slid.board, state.generator);
  const moves = state.moves + 1;
  const top = highest(placed.board);
  const streak = slid.merges > 0 ? state.streak + 1 : 0;
  const alive = canMove(placed.board) && moves < maxMoves;
  return {
    ...state,
    bestStreak: Math.max(state.bestStreak, streak),
    board: placed.board,
    closeShave:
      state.closeShave ||
      (emptyCells(placed.board).length === 0 && canMove(placed.board)),
    cornerKing:
      state.cornerKing || (top >= cornerLevel && inCorner(placed.board, top)),
    generator: placed.generator,
    merges: state.merges + slid.merges,
    moves,
    mostMerges: Math.max(state.mostMerges, slid.merges),
    over: !alive,
    reachedAt: state.reachedAt.map((at, level) =>
      at === 0 && level > 0 && level <= top ? moves : at,
    ),
    score: state.score + slid.points,
    spacious:
      state.spacious ||
      (top >= spaciousLevel &&
        emptyCells(placed.board).length >= spaciousEmpty),
    streak,
  };
}
