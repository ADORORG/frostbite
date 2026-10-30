import { columns, rows } from "../rules/constants.ts";

// The screen is drawn small, on a grid of whole pixels, and scaled up by `canvasScale`. The board is on the left, `cell` pixels to a shard, and
// the writing is in a column on the right.
export const screenWidth = 160;
export const screenHeight = 90;
export const canvasScale = 4;
export const cell = 10;
export const boardX = 5;
export const boardY = 5;
export const sideX = boardX + columns * cell + 6;

// The pixel a board cell's top left is at.
export const cellX = (index: number): number =>
  boardX + (index % columns) * cell;
export const cellY = (index: number): number =>
  boardY + Math.floor(index / columns) * cell;

// The board cell under a pixel of the screen, or -1 outside the board.
export function cellAt(x: number, y: number): number {
  const column = Math.floor((x - boardX) / cell);
  const row = Math.floor((y - boardY) / cell);
  return column < 0 || row < 0 || column >= columns || row >= rows
    ? -1
    : row * columns + column;
}
