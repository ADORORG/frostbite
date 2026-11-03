import { stepInt } from "@ador/game-sdk/seeded";

import { at, cellOf, kindOf, neighbour, runsOf, type Board } from "./board.ts";
import { cells, columns } from "./constants.ts";

// The board with the shards in two cells swapped.
export function swapped(board: Board, first: number, second: number): Board {
  return board.map((value, cell) =>
    cell === first
      ? at(board, second)
      : cell === second
        ? at(board, first)
        : value,
  );
}

// Whether swapping `cell` with its neighbour in `direction` makes a line (a swap that makes none is not a move).
export function makesLine(
  board: Board,
  cell: number,
  direction: number,
): boolean {
  const other = neighbour(cell, direction);
  return other >= 0 && runsOf(swapped(board, cell, other)).length > 0;
}

// Every swap that makes a line, as [cell, direction] with the direction right or down (the other two are the same swaps from the other end).
export function legalMoves(
  board: Board,
): readonly (readonly [number, number])[] {
  const found: (readonly [number, number])[] = [];
  for (let cell = 0; cell < cells; cell += 1)
    for (const direction of [1, 2])
      if (makesLine(board, cell, direction)) found.push([cell, direction]);
  return found;
}

export const hasMove = (board: Board): boolean => legalMoves(board).length > 0;

// A board with no line standing and at least one swap that makes one, filled from the generator state (a few tries at most): the first
// board of a run, and what a board with no swap left is shuffled into.
export function freshBoard(
  state: number,
  kinds: number,
): { readonly board: Board; readonly state: number } {
  let rng = state;
  for (;;) {
    const board: number[] = [];
    for (let cell = 0; cell < cells; cell += 1) {
      const x = cell % columns;
      const y = Math.floor(cell / columns);
      const banned = new Set<number>();
      if (
        x >= 2 &&
        kindOf(at(board, cellOf(x - 1, y))) ===
          kindOf(at(board, cellOf(x - 2, y)))
      )
        banned.add(kindOf(at(board, cellOf(x - 1, y))));
      if (
        y >= 2 &&
        kindOf(at(board, cellOf(x, y - 1))) ===
          kindOf(at(board, cellOf(x, y - 2)))
      )
        banned.add(kindOf(at(board, cellOf(x, y - 1))));
      const allowed = Array.from({ length: kinds }, (_, kind) => kind).filter(
        (kind) => !banned.has(kind),
      );
      const stepped = stepInt(rng, allowed.length);
      rng = stepped.state;
      board.push(allowed[stepped.value] ?? 0);
    }
    if (hasMove(board)) return { board, state: rng };
  }
}

// The board as it is if it has a swap to make, and otherwise a fresh one (a shuffle) from the generator state, and whether it was shuffled.
export function withMove(
  board: Board,
  state: number,
  kinds: number,
): {
  readonly board: Board;
  readonly shuffled: boolean;
  readonly state: number;
} {
  if (hasMove(board)) return { board, shuffled: false, state };
  const fresh = freshBoard(state, kinds);
  return { board: fresh.board, shuffled: true, state: fresh.state };
}
