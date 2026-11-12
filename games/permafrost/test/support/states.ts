import { columns, rows } from "../../src/rules/constants.ts";
import { newPiece } from "../../src/rules/lock.ts";
import { startRun } from "../../src/rules/state.ts";
import type { PermafrostState } from "../../src/rules/types.ts";

// A board from the rows at its bottom, written as text: "#" a filled cell, anything else empty. The last line is the bottom row.
export function boardOf(drawn: readonly string[]): readonly number[] {
  const board = Array.from({ length: columns * rows }, () => 0);
  drawn.forEach((line, at) => {
    const y = rows - drawn.length + at;
    [...line].forEach((char, x) => {
      if (char === "#") board[y * columns + x] = 8;
    });
  });
  return board;
}

// A row filled but for the columns named.
export const rowWithout = (...gaps: number[]): string =>
  Array.from({ length: columns }, (_, x) =>
    gaps.includes(x) ? "." : "#",
  ).join("");

// A run at its start with the changes given, and the piece named in hand.
export function stateWith(
  changes: Partial<PermafrostState>,
  kind = 1,
  seed = 7,
): PermafrostState {
  return { ...startRun(seed), piece: newPiece(kind), ...changes };
}
