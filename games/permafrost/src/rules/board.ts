import {
  columns,
  emptyCell,
  garbageCell,
  hiddenRows,
  rows,
} from "./constants.ts";
import { cellsOf } from "./pieces.ts";
import type { ActivePiece } from "./types.ts";

export const emptyBoard: readonly number[] = Array.from(
  { length: columns * rows },
  () => emptyCell,
);

const filledAt = (board: readonly number[], x: number, y: number): boolean =>
  (board[y * columns + x] ?? emptyCell) !== emptyCell;

// Whether a piece, at this place and turn, is wholly on the board and on nothing.
export function fits(
  board: readonly number[],
  piece: Pick<ActivePiece, "kind" | "rotation" | "x" | "y">,
): boolean {
  return cellsOf(piece.kind, piece.rotation).every(([cx, cy]) => {
    const x = piece.x + cx;
    const y = piece.y + cy;
    return (
      x >= 0 && x < columns && y >= 0 && y < rows && !filledAt(board, x, y)
    );
  });
}

export const resting = (
  board: readonly number[],
  piece: ActivePiece,
): boolean => !fits(board, { ...piece, y: piece.y + 1 });

// The board with the piece set into it.
export function setDown(
  board: readonly number[],
  piece: ActivePiece,
): readonly number[] {
  const next = [...board];
  for (const [cx, cy] of cellsOf(piece.kind, piece.rotation))
    next[(piece.y + cy) * columns + piece.x + cx] = piece.kind;
  return next;
}

// Whether the piece lies wholly above the screen, which ends the run.
export const aboveScreen = (piece: ActivePiece): boolean =>
  cellsOf(piece.kind, piece.rotation).every(
    ([, cy]) => piece.y + cy < hiddenRows,
  );

// The board without its full rows, the empty rows put back on top, and how many rows went.
export function clearFull(board: readonly number[]): {
  readonly board: readonly number[];
  readonly cleared: number;
} {
  const kept: number[][] = [];
  for (let y = 0; y < rows; y += 1) {
    const row = board.slice(y * columns, (y + 1) * columns);
    if (row.some((cell) => cell === emptyCell)) kept.push(row);
  }
  const cleared = rows - kept.length;
  const blank = Array.from({ length: cleared * columns }, () => emptyCell);
  return { board: [...blank, ...kept.flat()], cleared };
}

export const isEmpty = (board: readonly number[]): boolean =>
  board.every((cell) => cell === emptyCell);

// One grey row pushed up from below, whole but for the gap; or null when that would push the stack off the top.
export function rise(
  board: readonly number[],
  gap: number,
): readonly number[] | null {
  if (board.slice(0, columns).some((cell) => cell !== emptyCell)) return null;
  const grey = Array.from({ length: columns }, (_, x) =>
    x === gap ? emptyCell : garbageCell,
  );
  return [...board.slice(columns), ...grey];
}
