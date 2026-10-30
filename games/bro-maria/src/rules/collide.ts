import {
  levelTiles,
  pitRow,
  playerHeight,
  playerWidth,
  rows,
  tile,
} from "./constants.ts";
import type { Level } from "./types.ts";

// Where the hero can stand. The world is a grid of tiles: ground (from a column's top row down), floating tiles, a wall at the left edge of
// the level and at its right. Above the top of the world is open air, and below the last row is the pit.
export function solidAt(level: Level, column: number, row: number): boolean {
  if (column < 0 || column >= levelTiles) return true;
  if (row < 0 || row >= rows) return false;
  const top = level.ground[column] ?? pitRow;
  return row >= top || level.solid.has(column * 64 + row);
}

// Whether a box of this size with its top left at (x, y) overlaps anything solid.
export function overlaps(
  level: Level,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const first = Math.floor(x / tile);
  const last = Math.floor((x + width - 1) / tile);
  const above = Math.floor(y / tile);
  const below = Math.floor((y + height - 1) / tile);
  for (let column = first; column <= last; column += 1)
    for (let row = above; row <= below; row += 1)
      if (solidAt(level, column, row)) return true;
  return false;
}

export const heroOverlaps = (level: Level, x: number, y: number): boolean =>
  overlaps(level, x, y, playerWidth, playerHeight);

// Moves the hero along x by `dx`, stopping against a wall. Returns the new place and whether it was stopped.
export function moveAlongX(
  level: Level,
  x: number,
  y: number,
  dx: number,
): { readonly blocked: boolean; readonly x: number } {
  const next = x + dx;
  if (!heroOverlaps(level, next, y)) return { blocked: false, x: next };
  const snapped =
    dx > 0
      ? Math.floor((next + playerWidth - 1) / tile) * tile - playerWidth
      : (Math.floor(next / tile) + 1) * tile;
  return { blocked: true, x: snapped };
}

// Moves the hero along y by `dy`, stopping against floor or ceiling. `hit` says which: "floor" for a fall that landed, "ceiling" for a
// rise that struck something, and the column of the tile struck.
export function moveAlongY(
  level: Level,
  x: number,
  y: number,
  dy: number,
):
  | { readonly hit: null; readonly y: number }
  | { readonly hit: "ceiling"; readonly y: number; readonly row: number }
  | { readonly hit: "floor"; readonly y: number } {
  const next = y + dy;
  if (!heroOverlaps(level, x, next)) return { hit: null, y: next };
  if (dy > 0)
    return {
      hit: "floor",
      y: Math.floor((next + playerHeight - 1) / tile) * tile - playerHeight,
    };
  return {
    hit: "ceiling",
    row: Math.floor(next / tile),
    y: (Math.floor(next / tile) + 1) * tile,
  };
}

// The tile columns under the hero's width, for a ceiling that was struck.
export const columnsOf = (x: number): readonly number[] => {
  const first = Math.floor(x / tile);
  const last = Math.floor((x + playerWidth - 1) / tile);
  return Array.from({ length: last - first + 1 }, (_, at) => first + at);
};

export const standing = (level: Level, x: number, y: number): boolean =>
  heroOverlaps(level, x, y + 1);
