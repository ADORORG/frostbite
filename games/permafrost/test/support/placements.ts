import { clearFull, setDown } from "../../src/rules/board.ts";
import { columns, rows } from "../../src/rules/constants.ts";
import { newPiece } from "../../src/rules/lock.ts";
import { dropped, shifted, turned } from "../../src/rules/motion.ts";
import type {
  ActivePiece,
  Action,
  PermafrostState,
} from "../../src/rules/types.ts";

// Where a piece could be put, judged the way a careful player judges: low, with no holes and a level surface, and rows made when they can
// be. The search uses the rules' own moves, so each plan is one the keys can really carry out.
export interface Plan {
  readonly board: readonly number[];
  readonly keys: readonly Action[];
  readonly value: number;
}

const columnHeights = (board: readonly number[]): number[] =>
  Array.from({ length: columns }, (_, x) => {
    for (let y = 0; y < rows; y += 1)
      if ((board[y * columns + x] ?? 0) !== 0) return rows - y;
    return 0;
  });

function holesIn(board: readonly number[]): number {
  let holes = 0;
  for (let x = 0; x < columns; x += 1) {
    let covered = false;
    for (let y = 0; y < rows; y += 1) {
      const filled = (board[y * columns + x] ?? 0) !== 0;
      if (filled) covered = true;
      else if (covered) holes += 1;
    }
  }
  return holes;
}

// A player who saves the last column for the long piece keeps it empty until four rows are ready: each cell left in it costs.
const wellCost = 4;

// The weights of a well-known heuristic for stacking: low, few holes, a level surface, rows made when they can be.
function valueOf(
  board: readonly number[],
  cleared: number,
  well: boolean,
): number {
  const heights = columnHeights(board);
  const total = heights.reduce((sum, h) => sum + h, 0);
  const bumps = heights
    .slice(1)
    .reduce((sum, h, at) => sum + Math.abs(h - (heights[at] ?? 0)), 0);
  const wellFilled = well && cleared < 4 ? (heights[columns - 1] ?? 0) : 0;
  return (
    -wellCost * wellFilled -
    0.510066 * total +
    0.760666 * cleared -
    0.35663 * holesIn(board) -
    0.184483 * bumps
  );
}

// How many of the best places are looked into further.
const lookedAt = 12;

// Every place the piece in hand can be put by turning it and sliding it, best first.
export function plansFor(
  state: PermafrostState,
  well = false,
  ahead = false,
): readonly Plan[] {
  const plans: Plan[] = [];
  for (const turnsRight of [0, 1, 2, 3]) {
    let piece: ActivePiece = state.piece;
    const turning: Action[] = [];
    if (turnsRight === 3) {
      piece = turned(state.board, piece, -1);
      turning.push("turnLeft");
    } else
      for (let at = 0; at < turnsRight; at += 1) {
        piece = turned(state.board, piece, 1);
        turning.push("turnRight");
      }
    for (const direction of [-1, 1] as const) {
      let slid = piece;
      const sliding: Action[] = [];
      for (let step = 0; step <= columns; step += 1) {
        if (step > 0) {
          const next = shifted(state.board, slid, direction);
          if (next.x === slid.x) break;
          slid = next;
          sliding.push(direction === -1 ? "left" : "right");
        }
        if (direction === 1 && step === 0) continue;
        const landing = dropped(state.board, slid).piece;
        const cleared = clearFull(setDown(state.board, landing));
        plans.push({
          board: cleared.board,
          keys: [...turning, ...sliding, "hard"],
          value: valueOf(cleared.board, cleared.cleared, well),
        });
      }
    }
  }
  const best = plans.sort((a, b) => b.value - a.value);
  if (!ahead) return best;
  // Looking one piece further: a place is worth the best place the next piece then has.
  const next = state.queue[0] ?? 1;
  const looked = best.slice(0, lookedAt).map((plan) => {
    const after = plansFor(
      { ...state, board: plan.board, piece: { ...newPiece(next) } },
      well,
      false,
    );
    return { ...plan, value: plan.value + (after[0]?.value ?? -99) };
  });
  return looked.sort((a, b) => b.value - a.value);
}
