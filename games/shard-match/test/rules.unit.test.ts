import type { JsonValue } from "@ador/game-sdk/protocol";
import { describe, expect, it } from "vitest";

import { runsOf } from "../src/rules/board.ts";
import { cells, maxSwaps } from "../src/rules/constants.ts";
import { matchRules } from "../src/rules/index.ts";
import {
  freshBoard,
  hasMove,
  legalMoves,
  makesLine,
  withMove,
} from "../src/rules/moves.ts";
import {
  kindsAt,
  startRun,
  movesFor,
  type MatchState,
} from "../src/rules/state.ts";
import { swapOnce } from "../src/rules/swap.ts";
import { quiet, withCells } from "./support/boards.ts";

const taken = (next: MatchState | string): MatchState => {
  if (typeof next === "string") throw new Error(next);
  return next;
};
const first = (state: MatchState) => {
  const [move] = legalMoves(state.board);
  if (move === undefined) throw new Error("no move");
  return move;
};

describe("starting a run", () => {
  it("makes a board with no line standing and a swap to make, with the first swaps and level, the same for a seed", () => {
    for (const seed of [1, 2, 3, 4_000_000_000, 0]) {
      const state = startRun(seed);
      expect(state.board).toHaveLength(cells);
      expect(runsOf(state.board)).toEqual([]);
      expect(hasMove(state.board)).toBe(true);
      expect(state.level).toBe(1);
      expect(state.moves).toBe(movesFor(1));
      expect(Math.max(...state.board)).toBeLessThan(5);
      expect(startRun(seed)).toEqual(state);
    }
    expect(startRun(1).board).not.toEqual(startRun(2).board);
  });

  it("has five kinds of shard up to level three and six after", () => {
    expect([1, 3, 4, 20].map(kindsAt)).toEqual([5, 5, 6, 6]);
  });
});

describe("a move", () => {
  it("is a swap that makes a line, from either end", () => {
    const board = withCells([
      [0, 7, 7],
      [1, 7, 7],
      [3, 7, 7],
      [2, 7, 2],
    ]);
    expect(makesLine(board, 59, 3)).toBe(true);
    expect(makesLine(board, 58, 1)).toBe(true);
    expect(makesLine(board, 56, 1)).toBe(false);
    expect(makesLine(board, 56, 3)).toBe(false);
    expect(makesLine(quiet(), 0, 1)).toBe(false);
    expect(legalMoves(quiet())).toEqual([]);
    expect(hasMove(quiet())).toBe(false);
  });

  it("is listed once, as right or down", () => {
    const moves = legalMoves(startRun(5).board);
    expect(moves.length).toBeGreaterThan(0);
    expect(
      moves.every(([, direction]) => direction === 1 || direction === 2),
    ).toBe(true);
  });

  it("is made on a fresh board of the kinds asked for, whatever the generator state", () => {
    for (const state of [1, 2, 3, 4, 5]) {
      const { board } = freshBoard(state, 6);
      expect(runsOf(board)).toEqual([]);
      expect(hasMove(board)).toBe(true);
      expect(Math.max(...board)).toBeLessThan(6);
    }
  });
});

describe("a swap", () => {
  it("scores, uses a swap, counts and flashes what it cleared, and leaves no line standing", () => {
    const state = startRun(11);
    const [cell, to] = first(state);
    const next = taken(swapOnce(state, cell, to));
    expect(next.swaps).toBe(1);
    expect(next.score).toBeGreaterThanOrEqual(30);
    expect(next.cleared).toBeGreaterThanOrEqual(3);
    expect(next.lastCleared.length).toBeGreaterThanOrEqual(3);
    expect(next.lastGain).toBe(next.score);
    expect(next.lastDepth).toBeGreaterThanOrEqual(1);
    expect(next.moves).toBeLessThanOrEqual(movesFor(1) - 1 + 1 + 6);
    expect(next.bestSwap).toBe(next.score);
    expect(runsOf(next.board)).toEqual([]);
    expect(hasMove(next.board)).toBe(true);
  });

  it("is refused when it makes no line, goes off the board, or the run has made the most swaps", () => {
    const state = startRun(11);
    expect(swapOnce({ ...state, board: quiet() }, 0, 1)).toBe(
      "that swap makes no line",
    );
    expect(swapOnce(state, 0, 0)).toBe("that swap goes off the board");
    expect(swapOnce({ ...state, swaps: maxSwaps }, ...first(state))).toBe(
      "the run has made the most swaps it may",
    );
  });

  it("ends the run when the last swap is used, and ends it as spent when the record is full", () => {
    const state = startRun(11);
    const out = taken(swapOnce({ ...state, moves: 1 }, ...first(state)));
    expect(out.ended).toBe(true);
    expect(out.cause).toBe("out");
    const full = taken(
      swapOnce({ ...state, swaps: maxSwaps - 1, moves: 50 }, ...first(state)),
    );
    expect(full.ended).toBe(true);
    expect(full.cause).toBe("spent");
    const going = taken(swapOnce({ ...state, moves: 50 }, ...first(state)));
    expect(going.ended).toBe(false);
    expect(going.cause).toBeNull();
  });

  it("gives a swap for a star made, and none for a bomb", () => {
    const five = withCells([
      [0, 6, 7],
      [1, 6, 7],
      [3, 6, 7],
      [4, 6, 7],
      [2, 6, 3],
      [2, 5, 7],
    ]);
    const four = withCells([
      [0, 6, 7],
      [1, 6, 7],
      [3, 6, 7],
      [2, 6, 3],
      [2, 5, 7],
    ]);
    const base = { ...startRun(11), moves: 10 };
    const after = (board: readonly number[]) => {
      for (let rng = 1; rng < 200; rng += 1) {
        const next = taken(swapOnce({ ...base, board, rng }, 2 + 5 * 8, 2));
        if (next.lastDepth === 1) return next;
      }
      throw new Error("every fill chained");
    };
    expect(after(five).starsMade).toBe(1);
    expect(after(five).moves).toBe(10 - 1 + 1);
    expect(after(four).bombsMade).toBe(1);
    expect(after(four).moves).toBe(10 - 1);
  });

  it("shuffles a board with no swap left, and leaves one that has a swap", () => {
    const kept = withMove(startRun(3).board, 99, 5);
    expect(kept).toEqual({
      board: startRun(3).board,
      shuffled: false,
      state: 99,
    });
    const dead = withMove(quiet(), 99, 5);
    expect(dead.shuffled).toBe(true);
    expect(hasMove(dead.board)).toBe(true);
    expect(runsOf(dead.board)).toEqual([]);
    expect(dead.state).not.toBe(99);
    expect(withMove(quiet(), 99, 5)).toEqual(dead);
  });
});

describe("the rules as the platform replays them", () => {
  const init = (seed: number): MatchState => {
    const made = matchRules.init(seed, {});
    if (!made.ok) throw new Error(made.reason);
    return made.state;
  };

  it("start from a seed with no settings, and refuse any setting", () => {
    expect(init(5)).toEqual(startRun(5));
    expect(matchRules.init(5, { size: 9 })).toEqual({
      ok: false,
      reason: "no such setting: size",
    });
    expect(matchRules.id).toBe("shard-match");
    expect(matchRules.version).toBe(2);
  });

  it("make a swap by its cell and direction, and refuse what is not one", () => {
    const state = init(5);
    const [cell, to] = first(state);
    const swapped = matchRules.step(state, {
      data: { cell, to },
      type: "swap",
    });
    expect(swapped.ok && swapped.state.swaps).toBe(1);
    const refuse = (type: string, data?: JsonValue) => {
      const result = matchRules.step(
        state,
        data === undefined ? { type } : { data, type },
      );
      return result.ok ? "ok" : result.reason;
    };
    expect(refuse("jump")).toBe("no such input: jump");
    expect(refuse("swap")).toBe("the input takes an object");
    expect(refuse("swap", { cell })).toBe("the input takes exactly: cell, to");
    expect(refuse("swap", { cell: 1.5, to })).toBe(
      "cell must be a whole number on the board",
    );
    expect(refuse("swap", { cell: -1, to })).toBe(
      "cell must be a whole number on the board",
    );
    expect(refuse("swap", { cell: 64, to })).toBe(
      "cell must be a whole number on the board",
    );
    expect(refuse("swap", { cell: "1", to })).toBe(
      "cell must be a whole number on the board",
    );
    expect(refuse("swap", { cell, to: 4 })).toBe("to must be 0, 1, 2 or 3");
    expect(refuse("swap", { cell, to: 0.5 })).toBe("to must be 0, 1, 2 or 3");
    expect(refuse("swap", { cell, to: -1 })).toBe("to must be 0, 1, 2 or 3");
    expect(refuse("swap", { cell: 0, to: 3 })).toBe(
      "that swap goes off the board",
    );
    expect(refuse("end", {})).toBe("end takes no data");
  });

  it("end the run on `end`, and refuse anything after the end", () => {
    const state = init(5);
    const ended = matchRules.step(state, { type: "end" });
    expect(ended.ok && ended.state.ended).toBe(true);
    expect(matchRules.step({ ...state, ended: true }, { type: "end" })).toEqual(
      {
        ok: false,
        reason: "the run has ended",
      },
    );
  });
});
