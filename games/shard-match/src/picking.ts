import { directions, type Direction } from "./rules/constants.ts";
import { neighbour } from "./rules/board.ts";

// Where the player's hands are on the board: the cell the cursor is on, and the cell picked up to be swapped (-1 for none). Each hand
// movement gives the next place and, if it asks for one, the swap to make. None of it is part of the rules.
export interface Picking {
  readonly cursor: number;
  readonly grab: number;
}

export interface Next {
  readonly picking: Picking;
  // The swap this asks for, as the cell and the direction.
  readonly swap: { readonly cell: number; readonly direction: number } | null;
}

// An arrow: the cursor steps (and stays on the board); with a shard picked up it swaps that shard that way instead.
export function arrow(picking: Picking, direction: Direction): Next {
  const index = directions.indexOf(direction);
  if (picking.grab >= 0)
    return { picking, swap: { cell: picking.grab, direction: index } };
  const next = neighbour(picking.cursor, index);
  return {
    picking: next >= 0 ? { ...picking, cursor: next } : picking,
    swap: null,
  };
}

// Space: picks up the shard under the cursor, or puts it down if it is the one picked up.
export const toggled = (picking: Picking): Picking => ({
  ...picking,
  grab: picking.grab === picking.cursor ? -1 : picking.cursor,
});

// A tap on a cell: swaps the picked-up shard with it if they are neighbours; otherwise picks it up (or puts it down if it is the one held).
export function tapped(picking: Picking, cell: number): Next {
  const direction =
    picking.grab >= 0
      ? directions.findIndex((_, d) => neighbour(picking.grab, d) === cell)
      : -1;
  if (direction >= 0)
    return { picking, swap: { cell: picking.grab, direction } };
  return {
    picking: { cursor: cell, grab: picking.grab === cell ? -1 : cell },
    swap: null,
  };
}
