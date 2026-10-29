import { describe, expect, it } from "vitest";

import {
  canMove,
  emptyCells,
  highest,
  inCorner,
  slide,
} from "../src/rules/board.ts";

// A board written the way it is seen: rows of levels, 0 for an empty cell.
const board = (rows: readonly (readonly number[])[]): number[] => rows.flat();

describe("sliding tiles", () => {
  it("slides tiles to the edge and leaves a board that cannot move as it was", () => {
    const slid = slide(
      board([
        [0, 1, 0, 2],
        [0, 0, 0, 0],
        [3, 0, 0, 0],
        [0, 0, 0, 4],
      ]),
      "left",
    );
    expect(slid.board).toEqual(
      board([
        [1, 2, 0, 0],
        [0, 0, 0, 0],
        [3, 0, 0, 0],
        [4, 0, 0, 0],
      ]),
    );
    expect(slid.moved).toBe(true);
    expect(slid.merges).toBe(0);
    const still = slide(
      board([
        [1, 2, 0, 0],
        [3, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      "left",
    );
    expect(still.moved).toBe(false);
  });

  it("joins two equal tiles into the next level, and scores the new tile's value", () => {
    const slid = slide(
      board([
        [1, 1, 0, 0],
        [2, 0, 2, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
      "left",
    );
    expect(slid.board.slice(0, 8)).toEqual([2, 0, 0, 0, 3, 0, 0, 0]);
    expect(slid.merges).toBe(2);
    expect(slid.points).toBe(4 + 8);
  });

  it("joins a tile only once in a move, the pair nearest the edge first", () => {
    expect(
      slide(
        board([
          [1, 1, 1, 1],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]),
        "left",
      ).board.slice(0, 4),
    ).toEqual([2, 2, 0, 0]);
    expect(
      slide(
        board([
          [1, 1, 1, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]),
        "left",
      ).board.slice(0, 4),
    ).toEqual([2, 1, 0, 0]);
    expect(
      slide(
        board([
          [2, 1, 1, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]),
        "left",
      ).board.slice(0, 4),
    ).toEqual([2, 2, 0, 0]);
    expect(
      slide(
        board([
          [1, 1, 2, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ]),
        "left",
      ).board.slice(0, 4),
    ).toEqual([2, 2, 0, 0]);
  });

  it("slides the same way in each of the four directions", () => {
    const start = board([
      [1, 0, 0, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 2],
    ]);
    expect(slide(start, "left").board).toEqual(
      board([
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [3, 0, 0, 0],
      ]),
    );
    expect(slide(start, "right").board).toEqual(
      board([
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 3],
      ]),
    );
    expect(slide(start, "up").board).toEqual(
      board([
        [1, 0, 0, 1],
        [2, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
    );
    expect(slide(start, "down").board).toEqual(
      board([
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1, 0, 0, 1],
        [2, 0, 0, 2],
      ]),
    );
  });

  it("joins down a column as it does along a row", () => {
    const column = board([
      [1, 0, 0, 0],
      [1, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    expect(slide(column, "up").board).toEqual(
      board([
        [2, 0, 0, 0],
        [3, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]),
    );
    expect(slide(column, "down").board).toEqual(
      board([
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [2, 0, 0, 0],
        [3, 0, 0, 0],
      ]),
    );
  });
});

describe("reading a board", () => {
  const full = board([
    [1, 2, 1, 2],
    [2, 1, 2, 1],
    [1, 2, 1, 2],
    [2, 1, 2, 1],
  ]);

  it("finds the empty cells and the highest level", () => {
    expect(
      emptyCells(
        board([
          [1, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 5],
          [0, 0, 0, 0],
        ]),
      ),
    ).toHaveLength(14);
    expect(highest(full)).toBe(2);
    expect(highest([])).toBe(0);
  });

  it("can move while there is an empty cell or two equal tiles side by side, and not otherwise", () => {
    expect(canMove(full)).toBe(false);
    expect(
      canMove(
        board([
          [1, 2, 1, 2],
          [2, 1, 2, 1],
          [1, 2, 1, 2],
          [2, 1, 2, 0],
        ]),
      ),
    ).toBe(true);
    expect(
      canMove(
        board([
          [1, 1, 3, 2],
          [2, 3, 2, 3],
          [3, 2, 3, 2],
          [2, 3, 2, 3],
        ]),
      ),
    ).toBe(true);
    expect(
      canMove(
        board([
          [1, 2, 3, 2],
          [1, 3, 2, 3],
          [3, 2, 3, 2],
          [2, 3, 2, 3],
        ]),
      ),
    ).toBe(true);
  });

  it("knows a corner from the rest of the board", () => {
    for (const at of [0, 3, 12, 15]) {
      const cells = Array.from({ length: 16 }, () => 0);
      cells[at] = 9;
      expect(inCorner(cells, 9)).toBe(true);
    }
    const middle = Array.from({ length: 16 }, () => 0);
    middle[5] = 9;
    expect(inCorner(middle, 9)).toBe(false);
  });
});
