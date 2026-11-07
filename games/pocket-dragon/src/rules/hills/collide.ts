import {
  heroHeight,
  heroWidth,
  ceilingRow,
  pitRow,
  rows,
  tile,
  wallRow,
} from "./constants.ts";
import type { HillsLevel } from "./types.ts";

// Where Glitchy can stand: the ground (a column's top row and everything under it), floating ledges, and ice blocks not yet melted. The
// ends of the world, and the walls between the stage and its secret areas, are walls all the way up; above the world is open air up to
// a ceiling two tiles over the screen; below the last row is the pit.
export function solidAt(
  level: HillsLevel,
  melted: readonly boolean[],
  column: number,
  row: number,
): boolean {
  if (column < 0 || column >= level.ground.length) return true;
  const top = level.ground[column] ?? pitRow;
  if (row < 0) return row < ceilingRow || top === wallRow;
  if (row >= rows) return false;
  if (row >= top) return true;
  const key = column * 64 + row;
  if (level.solid.has(key)) return true;
  const ice = level.iceAt.get(key);
  return ice !== undefined && melted[ice] !== true;
}

// The tiles a box covers, as [column, row] pairs.
export function tilesUnder(
  x: number,
  y: number,
  width: number,
  height: number,
): readonly (readonly [number, number])[] {
  const tiles: (readonly [number, number])[] = [];
  for (
    let column = Math.floor(x / tile);
    column <= Math.floor((x + width - 1) / tile);
    column += 1
  )
    for (
      let row = Math.floor(y / tile);
      row <= Math.floor((y + height - 1) / tile);
      row += 1
    )
      tiles.push([column, row]);
  return tiles;
}

const heroOverlaps = (
  level: HillsLevel,
  melted: readonly boolean[],
  x: number,
  y: number,
): boolean =>
  tilesUnder(x, y, heroWidth, heroHeight).some(([column, row]) =>
    solidAt(level, melted, column, row),
  );

export function moveAlongX(
  level: HillsLevel,
  melted: readonly boolean[],
  x: number,
  y: number,
  dx: number,
): { readonly blocked: boolean; readonly x: number } {
  const next = x + dx;
  if (!heroOverlaps(level, melted, next, y)) return { blocked: false, x: next };
  const snapped =
    dx > 0
      ? Math.floor((next + heroWidth - 1) / tile) * tile - heroWidth
      : (Math.floor(next / tile) + 1) * tile;
  return { blocked: true, x: snapped };
}

export function moveAlongY(
  level: HillsLevel,
  melted: readonly boolean[],
  x: number,
  y: number,
  dy: number,
): { readonly hit: "ceiling" | "floor" | null; readonly y: number } {
  const next = y + dy;
  if (!heroOverlaps(level, melted, x, next)) return { hit: null, y: next };
  return dy > 0
    ? {
        hit: "floor",
        y: Math.floor((next + heroHeight - 1) / tile) * tile - heroHeight,
      }
    : { hit: "ceiling", y: (Math.floor(next / tile) + 1) * tile };
}

export const standing = (
  level: HillsLevel,
  melted: readonly boolean[],
  x: number,
  y: number,
): boolean => heroOverlaps(level, melted, x, y + 1);

export const touching = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
