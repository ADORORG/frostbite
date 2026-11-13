import { cell } from "./layout.ts";
import { pieceColour } from "./palette.ts";

type Mark = readonly [x: number, y: number, width: number, height: number];

// Each piece has a mark of its own inside every cell, so no one has to tell the pieces apart by colour alone.
const marks: Readonly<Record<number, readonly Mark[]>> = {
  1: [[2, 3, 4, 1]],
  2: [[3, 3, 2, 2]],
  3: [
    [3, 2, 2, 1],
    [3, 5, 2, 1],
  ],
  4: [
    [2, 5, 2, 1],
    [4, 2, 2, 1],
  ],
  5: [
    [2, 2, 2, 1],
    [4, 5, 2, 1],
  ],
  6: [[2, 2, 1, 4]],
  7: [[5, 2, 1, 4]],
  8: [
    [1, 1, 1, 1],
    [6, 6, 1, 1],
  ],
};

// One cell of a piece, `size` pixels wide with its top left at `x`, `y`: its colour, a lit edge and a shaded one, and its mark.
export function drawCell(
  context: CanvasRenderingContext2D,
  kind: number,
  x: number,
  y: number,
  size = cell,
): void {
  context.fillStyle = pieceColour[kind] ?? pieceColour[8] ?? "#fff";
  context.fillRect(x, y, size, size);
  context.fillStyle = "rgba(255,255,255,0.4)";
  context.fillRect(x, y, size, 1);
  context.fillRect(x, y, 1, size);
  context.fillStyle = "rgba(12,6,32,0.4)";
  context.fillRect(x, y + size - 1, size, 1);
  context.fillRect(x + size - 1, y, 1, size);
  if (size !== cell) return;
  for (const [mx, my, mw, mh] of marks[kind] ?? [])
    context.fillRect(x + mx, y + my, mw, mh);
}
