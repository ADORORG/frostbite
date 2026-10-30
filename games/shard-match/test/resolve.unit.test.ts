import { describe, expect, it } from "vitest";

import { cellOf, runsOf } from "../src/rules/board.ts";
import { bomb, star } from "../src/rules/constants.ts";
import { resolve } from "../src/rules/resolve.ts";
import { withCells } from "./support/boards.ts";

// Plays a board out for a seed that gives no further lines from what falls in, so the numbers are the ones of the set-up alone.
function calm(
  board: readonly number[],
  moved: readonly number[],
  depth: number,
) {
  for (let seed = 1; seed <= 400; seed += 1) {
    const done = resolve(board, moved, 5, seed);
    if (done.depth === depth) return done;
  }
  throw new Error("no seed leaves the board still");
}

describe("what a swap sets going", () => {
  it("clears a line of three, scores ten a shard, and leaves a board with no line", () => {
    const board = withCells([
      [0, 7, 7],
      [1, 7, 7],
      [2, 7, 7],
    ]);
    const done = calm(board, [cellOf(1, 7)], 1);
    expect(done.cleared).toBe(3);
    expect(done.points).toBe(30);
    expect(done.longest).toBe(3);
    expect(done.bombsMade + done.starsMade).toBe(0);
    expect(runsOf(done.board)).toEqual([]);
    expect([...done.clearedCells].sort((a, b) => a - b)).toEqual([56, 57, 58]);
  });

  it("makes a bomb of four where the swapped shard was, and a star of five or more, neither cleared", () => {
    const four = withCells([
      [1, 7, 7],
      [2, 7, 7],
      [3, 7, 7],
      [4, 7, 7],
    ]);
    const bombed = calm(four, [cellOf(3, 7)], 1);
    expect(bombed.bombsMade).toBe(1);
    expect(bombed.cleared).toBe(3);
    expect(bombed.board[cellOf(3, 7)]).toBe(7 + bomb * 8);
    expect(bombed.points).toBe(3 * 10 + 50);
    const five = withCells([
      [0, 6, 7],
      [1, 6, 7],
      [2, 6, 7],
      [3, 6, 7],
      [4, 6, 7],
    ]);
    const starred = calm(five, [cellOf(1, 6)], 1);
    expect(starred.starsMade).toBe(1);
    expect(starred.cleared).toBe(4);
    expect(starred.board[cellOf(1, 6)]).toBe(7 + star * 8);
    expect(starred.points).toBe(4 * 10 + 50 * 2);
  });

  it("puts the made special in the middle of the line when the swap was not in it", () => {
    const four = withCells([
      [1, 7, 7],
      [2, 7, 7],
      [3, 7, 7],
      [4, 7, 7],
    ]);
    const done = calm(four, [cellOf(6, 0), cellOf(6, 1)], 1);
    expect(done.board[cellOf(3, 7)]).toBe(7 + bomb * 8);
  });

  it("sets off a bomb that is in a cleared line: the nine cells round it go too", () => {
    const board = withCells([
      [3, 4, 7, bomb],
      [4, 4, 7],
      [5, 4, 7],
    ]);
    const done = calm(board, [cellOf(4, 4)], 1);
    expect(done.bombsFired).toBe(1);
    expect(done.cleared).toBe(10);
    expect(done.points).toBe(100);
  });

  it("sets off a star in a cleared line: its row and its column go too, and a bomb they reach goes off as well", () => {
    const board = withCells([
      [0, 4, 7, star],
      [1, 4, 7],
      [2, 4, 7],
      [5, 4, 3, bomb],
    ]);
    const done = calm(board, [cellOf(1, 4)], 1);
    expect(done.bombsFired).toBe(1);
    expect(done.cleared).toBeGreaterThan(15);
    for (const cell of [
      cellOf(7, 4),
      cellOf(0, 0),
      cellOf(0, 7),
      cellOf(6, 3),
      cellOf(6, 5),
    ])
      expect(done.clearedCells).toContain(cell);
  });

  it("clears again what falls into a line, scoring each step of the chain by its number", () => {
    // Swapping (2,6) and (2,7) makes a line of kind 0 on the foot; the shard that falls into (2,7) makes a line of kind 3 with its neighbours.
    const before = withCells([
      [0, 7, 0],
      [1, 7, 0],
      [2, 7, 3],
      [3, 7, 0],
      [4, 7, 3],
      [2, 6, 3],
      [1, 6, 4],
    ]);
    const swapped = withCells(
      [
        [2, 7, 0],
        [3, 7, 3],
      ],
      before,
    );
    expect(runsOf(before)).toEqual([]);
    const done = calm(swapped, [cellOf(2, 7), cellOf(3, 7)], 2);
    expect(done.depth).toBe(2);
    expect(done.cleared).toBe(6);
    expect(done.points).toBe(3 * 10 * 1 + 3 * 10 * 2);
  });

  it("has the same outcome for the same board and generator, and a different fill for another", () => {
    const board = withCells([
      [0, 7, 7],
      [1, 7, 7],
      [2, 7, 7],
    ]);
    expect(resolve(board, [1], 5, 77)).toEqual(resolve(board, [1], 5, 77));
    expect(resolve(board, [1], 5, 77).rng).not.toBe(
      resolve(board, [1], 5, 78).rng,
    );
  });
});
