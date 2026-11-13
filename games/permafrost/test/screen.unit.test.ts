import { describe, expect, it } from "vitest";

import { columns } from "../src/rules/constants.ts";
import { newPiece } from "../src/rules/lock.ts";
import { startRun } from "../src/rules/state.ts";
import type { PermafrostState } from "../src/rules/types.ts";
import { draw } from "../src/screen/draw.ts";
import {
  boardLeft,
  boardTop,
  cell,
  holdLeft,
  nextLeft,
  screenHeight,
  screenWidth,
} from "../src/screen/layout.ts";
import { colour, pieceColour } from "../src/screen/palette.ts";
import { boardOf } from "./support/states.ts";

type Mark = [
  colour: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha: number,
];

// A drawing surface that notes what is filled and what is outlined on it, and how see-through it was at the time.
function recorder() {
  const fills: Mark[] = [];
  const strokes: Mark[] = [];
  let fill = "";
  let stroke = "";
  let alpha = 1;
  const context = {
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push([fill, x, y, w, h, alpha]);
    },
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value: number) {
      alpha = value;
    },
    set fillStyle(value: string) {
      fill = value;
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      strokes.push([stroke, x, y, w, h, alpha]);
    },
    set strokeStyle(value: string) {
      stroke = value;
    },
  } as unknown as CanvasRenderingContext2D;
  return { context, fills, strokes };
}

const at = (x: number, row: number): [number, number] => [
  boardLeft + x * cell,
  boardTop + (row - 2) * cell,
];
// The cells of one colour, whole and not edges or marks (those are narrower, or another colour).
const cellsOf = (fills: Mark[], paint: string) =>
  fills.filter(([c, , , w, h]) => c === paint && w === cell && h === cell);
const withState = (
  changes: Partial<PermafrostState>,
  kind = 1,
): PermafrostState => ({
  ...startRun(7),
  piece: newPiece(kind),
  ...changes,
});

describe("the screen", () => {
  it("fills the whole screen first, then the board, and keeps every figure of the layout on the screen", () => {
    const { context, fills } = recorder();
    draw(context, { state: startRun(7) });
    expect(fills[0]).toEqual([
      colour.background,
      0,
      0,
      screenWidth,
      screenHeight,
      1,
    ]);
    expect(fills[1]?.[0]).toBe(colour.grid);
    expect(boardLeft + columns * cell).toBeLessThanOrEqual(nextLeft);
    expect(holdLeft + 28).toBeLessThanOrEqual(boardLeft);
    expect(nextLeft + 28).toBeLessThanOrEqual(screenWidth);
  });

  it("draws the piece in hand in its own colour, a cell for each of its four, where the rules have it", () => {
    const { context, fills } = recorder();
    draw(context, { state: withState({}, 3) });
    const state = withState({}, 3);
    const drawn = cellsOf(fills, pieceColour[3] ?? "").filter(
      ([, x]) => x >= boardLeft && x < nextLeft - 4,
    );
    expect(drawn).toHaveLength(4);
    const [x, y] = at(state.piece.x + 1, state.piece.y);
    expect(drawn.some(([, dx, dy]) => dx === x && dy === y - 0)).toBe(true);
  });

  it("draws the stack as it lies, each cell in the colour of the piece that made it, and the grey rows grey", () => {
    const { context, fills } = recorder();
    const board = [...boardOf(["...#......", "##########"])];
    board[21 * columns] = 5;
    draw(context, { state: withState({ board }) });
    const [x, y] = at(0, 21);
    expect(
      fills.some(
        ([c, dx, dy, w]) =>
          c === pieceColour[5] && dx === x && dy === y && w === cell,
      ),
    ).toBe(true);
    const [gx, gy] = at(3, 20);
    expect(
      fills.some(
        ([c, dx, dy, w]) =>
          c === colour.garbage && dx === gx && dy === gy && w === cell,
      ),
    ).toBe(true);
  });

  it("outlines where the piece will land, fainter than the piece", () => {
    const { context, strokes } = recorder();
    draw(context, { state: withState({}) });
    const ghost = strokes.filter(([c]) => c === colour.ghost);
    expect(ghost).toHaveLength(4);
    expect(ghost.every(([, , , , , alpha]) => alpha < 1)).toBe(true);
    const bottom = at(0, 21)[1];
    expect(ghost.every(([, , y]) => y >= bottom - cell)).toBe(true);
  });

  it("shows the row above the board dimly, so a new piece rises into view", () => {
    const { context, fills } = recorder();
    draw(context, { state: withState({}, 3) });
    const dim = fills.filter(
      ([c, , y, , , alpha]) =>
        c === pieceColour[3] && y < boardTop && alpha < 1,
    );
    expect(dim.length).toBeGreaterThan(0);
  });

  it("fades the piece as it rests on the stack and its time runs out", () => {
    const fresh = recorder();
    draw(fresh.context, {
      state: withState({ piece: { ...newPiece(2), y: 20 } }),
    });
    const resting = recorder();
    draw(resting.context, {
      state: withState({ piece: { ...newPiece(2), grounded: 25, y: 20 } }),
    });
    const alphaOf = (marks: Mark[]) =>
      Math.min(
        ...cellsOf(marks, pieceColour[2] ?? "")
          .filter(([, x]) => x < nextLeft - 4 && x >= boardLeft)
          .map(([, , , , , alpha]) => alpha),
      );
    expect(alphaOf(fresh.fills)).toBe(1);
    expect(alphaOf(resting.fills)).toBeLessThan(1);
    expect(alphaOf(resting.fills)).toBeGreaterThanOrEqual(0.5);
  });

  it("shows as many pieces to come as the level allows: three, then two, then one", () => {
    const boxes = (lines: number) => {
      const { context, strokes } = recorder();
      draw(context, { state: withState({ lines }) });
      return strokes.filter(
        ([c, x]) => c === colour.frame && x === nextLeft + 0.5,
      ).length;
    };
    expect(boxes(0)).toBe(3);
    expect(boxes(70)).toBe(2);
    expect(boxes(110)).toBe(1);
  });

  it("draws the piece held, plainly until it is used for this piece and dimly after", () => {
    const heldCells = (used: boolean) => {
      const { context, fills } = recorder();
      draw(context, { state: withState({ hold: 6, holdUsed: used }) });
      return fills.filter(
        ([c, x, , w]) => c === pieceColour[6] && x < boardLeft && w === 6,
      );
    };
    expect(heldCells(false)).toHaveLength(4);
    expect(heldCells(false).every(([, , , , , alpha]) => alpha === 1)).toBe(
      true,
    );
    expect(heldCells(true).every(([, , , , , alpha]) => alpha < 0.5)).toBe(
      true,
    );
    const { context, fills } = recorder();
    draw(context, { state: withState({}) });
    expect(
      fills.some(
        ([c, x, , w]) => c === pieceColour[6] && x < boardLeft && w === 6,
      ),
    ).toBe(false);
  });

  it("frames the board in the danger colour and draws no piece once the stack has reached the top", () => {
    const calm = recorder();
    draw(calm.context, { state: withState({}) });
    expect(
      calm.strokes.some(
        ([c, x]) => c === colour.danger && x === boardLeft - 0.5,
      ),
    ).toBe(false);
    const over = recorder();
    draw(over.context, { state: withState({ blocked: true }) });
    expect(
      over.strokes.some(
        ([c, x]) => c === colour.danger && x === boardLeft - 0.5,
      ),
    ).toBe(true);
    expect(over.strokes.filter(([c]) => c === colour.ghost)).toHaveLength(0);
    expect(cellsOf(over.fills, pieceColour[1] ?? "")).toHaveLength(0);
  });

  it("gives each piece a mark of its own inside its cells, so colour is not the only way to tell them apart", () => {
    const marksOf = (kind: number) => {
      const { context, fills } = recorder();
      draw(context, {
        state: withState({
          board: boardOf([]).map((_, i) => (i === 21 * columns ? kind : 0)),
        }),
      });
      const [x, y] = at(0, 21);
      return fills
        .filter(
          ([, mx, my, w, h]) =>
            mx > x &&
            mx < x + cell &&
            my > y &&
            my < y + cell &&
            w < cell &&
            h < cell &&
            mx + w < x + cell,
        )
        .map(
          ([, mx, my, w, h]) =>
            `${String(mx - x)},${String(my - y)},${String(w)},${String(h)}`,
        )
        .join(";");
    };
    const all = [1, 2, 3, 4, 5, 6, 7].map(marksOf);
    expect(new Set(all).size).toBe(7);
    expect(all.every((marks) => marks !== "")).toBe(true);
  });
});
