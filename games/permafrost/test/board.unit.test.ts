import { describe, expect, it } from "vitest";

import {
  aboveScreen,
  clearFull,
  emptyBoard,
  fits,
  isEmpty,
  resting,
  rise,
  setDown,
} from "../src/rules/board.ts";
import { columns, rows } from "../src/rules/constants.ts";
import { newPiece } from "../src/rules/lock.ts";
import { boardOf, rowWithout } from "./support/states.ts";

const at = (x: number, y: number, kind = 1, rotation = 0) => ({
  ...newPiece(kind),
  rotation,
  x,
  y,
});

describe("the board", () => {
  it("is ten by twenty-two and empty to begin with", () => {
    expect(emptyBoard).toHaveLength(columns * rows);
    expect(isEmpty(emptyBoard)).toBe(true);
  });

  it("lets a piece fit only wholly on the board and on nothing", () => {
    expect(fits(emptyBoard, at(3, 1))).toBe(true);
    expect(fits(emptyBoard, at(-1, 1))).toBe(false);
    expect(fits(emptyBoard, at(7, 1))).toBe(false);
    expect(fits(emptyBoard, at(3, -2))).toBe(false);
    expect(fits(emptyBoard, at(3, rows - 1))).toBe(false);
    expect(fits(emptyBoard, at(3, rows - 2))).toBe(true);
    expect(fits(boardOf(["###.######"]), at(3, rows - 2))).toBe(false);
  });

  it("says a piece rests when one row more would not fit, and sets it down as its own number", () => {
    const floor = at(3, rows - 2);
    expect(resting(emptyBoard, floor)).toBe(true);
    expect(resting(emptyBoard, at(3, 1))).toBe(false);
    const set = setDown(emptyBoard, floor);
    expect(set.filter((cell) => cell === 1)).toHaveLength(4);
    expect(isEmpty(set)).toBe(false);
    expect(isEmpty(emptyBoard)).toBe(true);
  });

  it("knows a piece that lies wholly above the screen from one that reaches it", () => {
    expect(aboveScreen(at(3, 0))).toBe(true);
    expect(aboveScreen(at(3, 1))).toBe(false);
  });

  it("clears the full rows, keeps the others in order and puts empty rows on top", () => {
    const board = boardOf([
      ".#........",
      rowWithout(),
      "#.........",
      rowWithout(),
    ]);
    const result = clearFull(board);
    expect(result.cleared).toBe(2);
    expect(result.board).toHaveLength(columns * rows);
    expect(result.board).toEqual(boardOf([".#........", "#........."]));
    expect(clearFull(emptyBoard).cleared).toBe(0);
    expect(clearFull(boardOf([rowWithout(4)])).cleared).toBe(0);
  });

  it("rises by one grey row with the gap where it is told, and refuses to push the stack off the top", () => {
    expect(rise(boardOf(["#........."]), 3)).toEqual(
      boardOf(["#.........", rowWithout(3)]),
    );
    expect(rise(emptyBoard, 0)?.slice(-columns)).toEqual(
      Array.from({ length: columns }, (_, x) => (x === 0 ? 0 : 8)),
    );
    const full = [...emptyBoard];
    full[4] = 1;
    expect(rise(full, 0)).toBeNull();
  });
});
