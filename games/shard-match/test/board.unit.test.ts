import { describe, expect, it } from "vitest";

import {
  blastOf,
  at,
  cellOf,
  kindOf,
  neighbour,
  runsOf,
  settle,
  specialOf,
} from "../src/rules/board.ts";
import { bomb, cells, kindSlots, star } from "../src/rules/constants.ts";
import { quiet, withCells } from "./support/boards.ts";

describe("cells and neighbours", () => {
  it("name a cell by row and column, and split a value into its kind and special", () => {
    expect(cellOf(3, 2)).toBe(19);
    expect(kindOf(2 + bomb * kindSlots)).toBe(2);
    expect(specialOf(2 + star * kindSlots)).toBe(star);
    expect(specialOf(5)).toBe(0);
    expect(at(quiet(), 5)).toBe(quiet()[5]);
  });

  it("step one cell in each direction, and none off an edge or in a direction that does not exist", () => {
    expect([0, 1, 2, 3].map((d) => neighbour(27, d))).toEqual([19, 28, 35, 26]);
    expect(neighbour(3, 0)).toBe(-1);
    expect(neighbour(7, 1)).toBe(-1);
    expect(neighbour(60, 2)).toBe(-1);
    expect(neighbour(8, 3)).toBe(-1);
    expect(neighbour(0, 4)).toBe(-1);
  });
});

describe("lines", () => {
  it("are none on a quiet board", () => {
    expect(runsOf(quiet())).toEqual([]);
  });

  it("are found across and down, three or longer, with the cells they cover", () => {
    const across = runsOf(
      withCells([
        [2, 3, 7],
        [3, 3, 7],
        [4, 3, 7],
        [5, 3, 7],
      ]),
    );
    expect(across).toEqual([{ cells: [26, 27, 28, 29] }]);
    const down = runsOf(
      withCells([
        [6, 1, 7],
        [6, 2, 7],
        [6, 3, 7],
      ]),
    );
    expect(down).toEqual([{ cells: [14, 22, 30] }]);
  });

  it("are found at the edges of the board, and are not found when only two are in a row", () => {
    const edge = runsOf(
      withCells([
        [5, 0, 7],
        [6, 0, 7],
        [7, 0, 7],
        [0, 6, 7],
        [0, 7, 7],
      ]),
    );
    expect(edge).toEqual([{ cells: [5, 6, 7] }]);
    const foot = runsOf(
      withCells([
        [3, 5, 7],
        [3, 6, 7],
        [3, 7, 7],
      ]),
    );
    expect(foot).toEqual([{ cells: [43, 51, 59] }]);
  });

  it("count a bomb or a star as the kind it is, and find a shard in a line across and another down", () => {
    const mixed = runsOf(
      withCells([
        [1, 1, 7],
        [2, 1, 7, bomb],
        [3, 1, 7, star],
      ]),
    );
    expect(mixed).toEqual([{ cells: [9, 10, 11] }]);
    const cross = runsOf(
      withCells([
        [2, 4, 7],
        [3, 4, 7],
        [4, 4, 7],
        [3, 3, 7],
        [3, 5, 7],
      ]),
    );
    expect(cross.map((run) => run.cells.length).sort()).toEqual([3, 3]);
  });
});

describe("a blast", () => {
  it("of a bomb is the nine cells round it, cut at the edges", () => {
    expect(blastOf(27, bomb)).toHaveLength(9);
    expect(blastOf(27, bomb)).toContain(18);
    expect(blastOf(27, bomb)).toContain(36);
    expect(new Set(blastOf(0, bomb))).toEqual(new Set([0, 1, 8, 9]));
    expect(new Set(blastOf(63, bomb))).toEqual(new Set([54, 55, 62, 63]));
  });

  it("of a star is its row and its column, and nothing for a plain shard", () => {
    const hit = new Set(blastOf(27, star));
    expect(hit.size).toBe(15);
    expect([24, 31, 3, 59].every((cell) => hit.has(cell))).toBe(true);
    expect(blastOf(27, 0)).toEqual([]);
  });
});

describe("settling", () => {
  it("lets what is left fall to the foot of its column and fills the top from the generator, the same way for the same state", () => {
    const board = quiet();
    const gone = new Set([cellOf(2, 7), cellOf(2, 6), cellOf(5, 0)]);
    const first = settle(board, gone, 5, 12345);
    expect(first).toEqual(settle(board, gone, 5, 12345));
    expect(first.board).toHaveLength(cells);
    expect(first.board[cellOf(2, 7)]).toBe(board[cellOf(2, 5)]);
    expect(first.board[cellOf(2, 6)]).toBe(board[cellOf(2, 4)]);
    expect(first.board[cellOf(0, 7)]).toBe(board[cellOf(0, 7)]);
    expect(first.board[cellOf(5, 1)]).toBe(board[cellOf(5, 1)]);
    expect(first.state).not.toBe(12345);
  });

  it("says how far each shard fell: the rows it dropped, and for a new shard the rows it came down from above", () => {
    const board = quiet();
    const gone = new Set([cellOf(2, 7), cellOf(2, 6), cellOf(5, 0)]);
    const { drops } = settle(board, gone, 5, 1);
    expect(drops[cellOf(2, 7)]).toBe(2);
    expect(drops[cellOf(2, 6)]).toBe(2);
    expect(drops[cellOf(2, 5)]).toBe(2);
    expect(drops[cellOf(2, 0)]).toBe(2);
    expect(drops[cellOf(2, 1)]).toBe(2);
    expect(drops[cellOf(5, 0)]).toBe(1);
    expect(drops[cellOf(5, 1)]).toBe(0);
    expect(drops[cellOf(0, 3)]).toBe(0);
    const [first, second] = [
      settle(board, new Set([cellOf(1, 7), cellOf(1, 6)]), 5, 1).drops,
      settle(board, new Set([cellOf(1, 6)]), 5, 1).drops,
    ];
    expect(first[cellOf(1, 0)]).toBe(2);
    expect(second[cellOf(1, 0)]).toBe(1);
  });

  it("fills only with the kinds asked for, and does not touch the generator when nothing is cleared", () => {
    const filled = settle(quiet(), new Set([0, 1, 2, 3, 4, 5, 6, 7]), 3, 99);
    for (let x = 0; x < 8; x += 1) expect(filled.board[x]).toBeLessThan(3);
    expect(settle(quiet(), new Set(), 5, 99)).toEqual({
      board: quiet(),
      drops: Array.from({ length: cells }, () => 0),
      state: 99,
    });
  });
});
