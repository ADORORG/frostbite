import { stepInt } from "@ador/game-sdk/seeded";

import {
  bomb,
  cells,
  columns,
  deltas,
  kindSlots,
  rows,
  star,
} from "./constants.ts";

export type Board = readonly number[];

export const kindOf = (value: number): number => value % kindSlots;
export const specialOf = (value: number): number =>
  Math.floor(value / kindSlots);
export const at = (board: Board, cell: number): number => board[cell] ?? 0;
export const cellOf = (x: number, y: number): number => y * columns + x;

// The cell a step from `cell` in `direction` lands on, or -1 off the board.
export function neighbour(cell: number, direction: number): number {
  const delta = deltas[direction];
  if (delta === undefined) return -1;
  const x = (cell % columns) + delta.x;
  const y = Math.floor(cell / columns) + delta.y;
  return x < 0 || y < 0 || x >= columns || y >= rows ? -1 : cellOf(x, y);
}

// A line of three or more of one kind, as the cells it covers.
export interface Run {
  readonly cells: readonly number[];
}

// Every horizontal and vertical line of three or more shards of one kind (a shard may be in one of each).
export function runsOf(board: Board): readonly Run[] {
  const found: Run[] = [];
  for (const across of [true, false]) {
    const lines = across ? rows : columns;
    const length = across ? columns : rows;
    for (let line = 0; line < lines; line += 1) {
      let start = 0;
      const cell = (position: number): number =>
        across ? cellOf(position, line) : cellOf(line, position);
      for (let end = 1; end <= length; end += 1) {
        const same =
          end < length &&
          kindOf(at(board, cell(end))) === kindOf(at(board, cell(start)));
        if (same) continue;
        if (end - start >= 3)
          found.push({
            cells: Array.from({ length: end - start }, (_, i) =>
              cell(start + i),
            ),
          });
        start = end;
      }
    }
  }
  return found;
}

// The cells that a bomb or star at `cell` clears when it goes off, itself included.
export function blastOf(cell: number, special: number): readonly number[] {
  const x = cell % columns;
  const y = Math.floor(cell / columns);
  const hit: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1)
    for (let dx = -1; dx <= 1; dx += 1)
      if (
        special === bomb &&
        x + dx >= 0 &&
        x + dx < columns &&
        y + dy >= 0 &&
        y + dy < rows
      )
        hit.push(cellOf(x + dx, y + dy));
  if (special === star) {
    for (let i = 0; i < columns; i += 1) hit.push(cellOf(i, y));
    for (let i = 0; i < rows; i += 1) hit.push(cellOf(x, i));
  }
  return hit;
}

// Lets what is left fall to the bottom of its column and fills the gaps at the top with new shards of the first `kinds` kinds, from the
// generator state. Returns the new board and the state to go on from.
export function settle(
  board: Board,
  gone: ReadonlySet<number>,
  kinds: number,
  state: number,
): { readonly board: Board; readonly state: number } {
  const next = new Array<number>(cells).fill(0);
  let rng = state;
  for (let x = 0; x < columns; x += 1) {
    let write = rows - 1;
    for (let y = rows - 1; y >= 0; y -= 1)
      if (!gone.has(cellOf(x, y))) {
        next[cellOf(x, write)] = at(board, cellOf(x, y));
        write -= 1;
      }
    for (; write >= 0; write -= 1) {
      const stepped = stepInt(rng, kinds);
      rng = stepped.state;
      next[cellOf(x, write)] = stepped.value;
    }
  }
  return { board: next, state: rng };
}
