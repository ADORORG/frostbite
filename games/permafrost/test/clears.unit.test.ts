import { describe, expect, it } from "vitest";

import { advance } from "../src/rules/advance.ts";
import { columns, rows } from "../src/rules/constants.ts";
import { garbageEvery } from "../src/rules/difficulty.ts";
import { newPiece } from "../src/rules/lock.ts";
import { close, press } from "./support/drive.ts";
import { boardOf, rowWithout, stateWith } from "./support/states.ts";

// The long piece standing in the last column, ready to drop down it.
const upright = { ...newPiece(1), rotation: 1, x: columns - 3 };
const gapAtEnd = rowWithout(columns - 1);

describe("clearing rows", () => {
  it("clears a row, scores it with the drop, and counts it", () => {
    const state = stateWith(
      { board: boardOf(["#.........", rowWithout(3, 4, 5, 6)]) },
      1,
    );
    const done = press(state, "d");
    expect(done.lines).toBe(1);
    expect(done.score).toBe(100 + 2 * (rows - 2 - state.piece.y));
    expect(done.combo).toBe(0);
    expect(done.board).toEqual(boardOf(["#........."]));
  });

  it("scores four at once as a four, and the next four after it three halves", () => {
    const four = [gapAtEnd, gapAtEnd, gapAtEnd, gapAtEnd];
    const first = press(
      stateWith({ board: boardOf(four), piece: upright }),
      "d",
    );
    expect(first.fours).toBe(1);
    expect(first.lines).toBe(4);
    expect(first.backToBack).toBe(true);
    expect(first.backToBackFours).toBe(0);
    const again = press(
      { ...first, board: boardOf(four), piece: { ...upright } },
      "d",
    );
    expect(again.fours).toBe(2);
    expect(again.backToBackFours).toBe(1);
    expect(again.score - first.score).toBeGreaterThanOrEqual(1_200 + 50);
  });

  it("ends the back-to-back when fewer than four are cleared, and keeps it through a drop that clears none", () => {
    const four = [gapAtEnd, gapAtEnd, gapAtEnd, gapAtEnd];
    const kept = press(
      stateWith({ backToBack: true, board: boardOf([]) }, 2),
      "d",
    );
    expect(kept.backToBack).toBe(true);
    const lost = press(
      stateWith({
        backToBack: true,
        board: boardOf([gapAtEnd]),
        piece: upright,
      }),
      "d",
    );
    expect(lost.lines).toBe(1);
    expect(lost.backToBack).toBe(false);
    expect(four).toHaveLength(4);
  });

  it("builds a combo on clears in a row, and ends it on a drop that clears nothing", () => {
    const board = boardOf([gapAtEnd, gapAtEnd]);
    const one = press(stateWith({ board, piece: upright }), "d");
    expect(one.combo).toBe(0);
    const two = press(
      { ...one, board: boardOf([gapAtEnd]), piece: { ...upright } },
      "d",
    );
    expect(two.combo).toBe(1);
    expect(two.maxCombo).toBe(1);
    expect(two.score - one.score).toBeGreaterThanOrEqual(100 + 50);
    const none = press({ ...two, piece: newPiece(2) }, "d");
    expect(none.combo).toBe(-1);
    expect(none.maxCombo).toBe(1);
  });

  it("pays for leaving the board empty", () => {
    const state = stateWith({ board: boardOf([rowWithout(3, 4, 5, 6)]) }, 1);
    const done = press(state, "d");
    expect(done.perfectClears).toBe(1);
    expect(done.score).toBeGreaterThanOrEqual(2_000);
    const notEmpty = press(
      stateWith({ board: boardOf(["#.........", rowWithout(3, 4, 5, 6)]) }, 1),
      "d",
    );
    expect(notEmpty.perfectClears).toBe(0);
  });

  it("raises the level every ten lines and scores by the level it was cleared on", () => {
    const row = ["#.........", rowWithout(3, 4, 5, 6)];
    const state = stateWith({ board: boardOf(row), lines: 9 }, 1);
    const first = press(state, "d");
    expect(first.lines).toBe(10);
    const second = press(
      {
        ...first,
        board: boardOf(row),
        combo: -1,
        piece: newPiece(1),
        score: 0,
      },
      "d",
    );
    expect(second.score).toBe(200 + 2 * (rows - 2 - newPiece(1).y));
  });

  it("notes the tick of the fortieth line, and the lines cleared before the first hold", () => {
    const board = boardOf([rowWithout(3, 4, 5, 6)]);
    const free = advance(stateWith({ board, lines: 39 }, 1), 100);
    const done = press(free, "d");
    expect(done.sprintTick).toBe(100);
    expect(done.holdFreeLines).toBe(1);
    const held = press(stateWith({ board, lines: 39 }, 1), "h");
    expect(held.holds).toBe(1);
    expect(
      press({ ...held, piece: newPiece(1), holdUsed: false }, "d")
        .holdFreeLines,
    ).toBe(0);
  });
});

describe("grey rows", () => {
  const level12 = 110;
  const every = garbageEvery(12) ?? 0;

  it("rise only once enough pieces are set, with one gap, and lift the stack", () => {
    const due = stateWith({ lines: level12, piecesSinceGarbage: every - 1 }, 2);
    const risen = press(due, "d");
    expect(risen.garbageRows).toBe(1);
    expect(risen.piecesSinceGarbage).toBe(0);
    const bottom = risen.board.slice(-columns);
    expect(bottom.filter((cell) => cell === 0)).toHaveLength(1);
    expect(bottom.filter((cell) => cell === 8)).toHaveLength(columns - 1);
    const early = press(
      stateWith({ lines: level12, piecesSinceGarbage: every - 2 }, 2),
      "d",
    );
    expect(early.garbageRows).toBe(0);
    const calm = press(stateWith({ piecesSinceGarbage: 99 }, 2), "d");
    expect(calm.garbageRows).toBe(0);
  });

  it("often leave the gap where it was, and often move it", () => {
    let state = stateWith({ lines: level12 }, 2);
    const gaps: number[] = [];
    for (let at = 0; at < 60; at += 1) {
      state = press(
        {
          ...state,
          board: boardOf([]),
          piece: newPiece(2),
          piecesSinceGarbage: every - 1,
        },
        "d",
      );
      gaps.push(state.gap);
    }
    const same = gaps.filter(
      (gap, at) => at > 0 && gap === gaps[at - 1],
    ).length;
    expect(same).toBeGreaterThan(20);
    expect(same).toBeLessThan(55);
    expect(gaps.every((gap) => gap >= 0 && gap < columns)).toBe(true);
  });

  it("end the run when they would lift the stack off the top", () => {
    const tall = boardOf(Array.from({ length: rows }, () => "........#"));
    const due = stateWith(
      { board: tall, lines: level12, piecesSinceGarbage: every - 1 },
      2,
    );
    const early = { ...due, piecesSinceGarbage: every - 2 };
    expect(press(early, "d").blocked).toBe(false);
    expect(press(due, "d").blocked).toBe(true);
  });
});

describe("the end of a run", () => {
  it("is a stack that leaves no room for the next piece, after which nothing moves", () => {
    const high = boardOf(Array.from({ length: rows - 1 }, () => "....##...."));
    const state = stateWith(
      { board: high, piece: { ...newPiece(2), x: 7, y: 5 } },
      2,
    );
    const over = press(state, "d");
    expect(over.blocked).toBe(true);
    expect(over.cause).toBe("blocked");
    expect(over.ended).toBe(false);
    expect(advance(over, 5_000).tick).toBe(5_000);
    expect(advance(over, 5_000).board).toEqual(over.board);
  });

  it("is a piece set wholly above the screen", () => {
    const columnsFilled = boardOf(
      Array.from({ length: rows - 2 }, () => "....##...."),
    );
    const state = stateWith(
      { board: columnsFilled, piece: { ...newPiece(2), x: 4, y: 0 } },
      2,
    );
    expect(press(state, "d").blocked).toBe(true);
  });

  it("is scored once it is closed, with the reason, and not before", () => {
    const state = stateWith({ score: 4_200 }, 2);
    const closed = close(advance(state, 60), 90);
    expect(closed.ended).toBe(true);
    expect(closed.cause).toBe("ended");
    expect(closed.tick).toBe(90);
    expect(closed.score).toBe(4_200);
  });
});
