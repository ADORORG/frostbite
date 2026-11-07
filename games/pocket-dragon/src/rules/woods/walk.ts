import {
  cell,
  clueCount,
  frozen,
  gate,
  radius,
  size,
  tree,
} from "./constants.ts";
import type { WoodsState } from "./types.ts";

// The moon gate opens for a dragon who has read every clue stone and built the egg launcher (found all its parts).
export const gateOpen = (state: WoodsState): boolean =>
  state.clues.filter(Boolean).length >= clueCount && state.parts.every(Boolean);

// The cell (by `y * size + x`) a point of the woods is in.
export const cellAt = (x: number, y: number): number =>
  Math.floor(y / cell) * size + Math.floor(x / cell);

// What stops Glitchy: trees, the frozen hedge until it is melted, and the moon gate until it opens.
export function blocks(state: WoodsState, index: number): boolean {
  const wall = state.level.walls[index];
  if (wall === undefined || wall === tree) return true;
  if (wall === frozen) return !state.melted;
  if (wall === gate) return !gateOpen(state);
  return false;
}

// Whether Glitchy, as a square `radius` either side of (x, y), would stand in anything that stops it.
export const boxBlocked = (state: WoodsState, x: number, y: number): boolean =>
  [
    [x - radius, y - radius],
    [x + radius - 1, y - radius],
    [x - radius, y + radius - 1],
    [x + radius - 1, y + radius - 1],
  ].some(
    ([px = 0, py = 0]) => px < 0 || py < 0 || blocks(state, cellAt(px, py)),
  );

// Moves by (dx, dy), one axis at a time, so Glitchy slides along a hedge instead of sticking to it.
export function slide(
  state: WoodsState,
  dx: number,
  dy: number,
): { readonly x: number; readonly y: number } {
  const x = boxBlocked(state, state.x + dx, state.y) ? state.x : state.x + dx;
  const y = boxBlocked(state, x, state.y + dy) ? state.y : state.y + dy;
  return { x, y };
}
