import { cellOf } from "../../src/rules/board.ts";
import type { Board } from "../../src/rules/board.ts";
import { cells, columns, kindSlots } from "../../src/rules/constants.ts";

// A board with no line standing: kind (x + 2y) mod 5, so neighbours across differ by one and neighbours down by two. Tests change a few cells
// of it to set up what they check.
export const quiet = (): number[] =>
  Array.from(
    { length: cells },
    (_, cell) => ((cell % columns) + 2 * Math.floor(cell / columns)) % 5,
  );

// The board with cells set: each entry is `[x, y, kind, special?]`.
export function withCells(
  changes: readonly (readonly [number, number, number, number?])[],
  base: Board = quiet(),
): Board {
  const board = [...base];
  for (const [x, y, kind, special = 0] of changes)
    board[cellOf(x, y)] = kind + special * kindSlots;
  return board;
}
