import { describe, expect, it } from "vitest";

import {
  carryMoves,
  cells,
  fewestMoves,
  firstMoves,
  leftoverPoints,
  mostFrost,
} from "../src/rules/constants.ts";
import { runsOf } from "../src/rules/board.ts";
import { hasMove, legalMoves } from "../src/rules/moves.ts";
import {
  frostFor,
  goalOf,
  movesFor,
  newLevel,
  startRun,
  type MatchState,
} from "../src/rules/state.ts";
import { swapOnce } from "../src/rules/swap.ts";

const taken = (next: MatchState | string): MatchState => {
  if (typeof next === "string") throw new Error(next);
  return next;
};
const first = (state: MatchState) => {
  const [move] = legalMoves(state.board);
  if (move === undefined) throw new Error("no move");
  return move;
};
const frosted = (state: MatchState): number =>
  state.frost.filter(Boolean).length;

describe("what a level asks", () => {
  it("is a score on the odd levels (more each time) and frost to break on the even ones", () => {
    expect([1, 3, 5].map(goalOf)).toEqual([
      { kind: "score", target: 950 },
      { kind: "score", target: 1_850 },
      { kind: "score", target: 2_750 },
    ]);
    expect([2, 4, 20].map(goalOf)).toEqual([
      { kind: "frost" },
      { kind: "frost" },
      { kind: "frost" },
    ]);
  });

  it("gives fewer swaps as the levels go, to a least, and lays frost only on the even levels, more each time, to a most", () => {
    expect([1, 2, 3, 30, 300].map(movesFor)).toEqual([
      firstMoves,
      firstMoves,
      firstMoves - 1,
      fewestMoves,
      fewestMoves,
    ]);
    expect([1, 3, 2, 4, 10, 100].map(frostFor)).toEqual([
      0,
      0,
      14,
      20,
      38 > mostFrost ? mostFrost : 38,
      mostFrost,
    ]);
  });

  it("is a new board with no line and a swap to make, and exactly the frost the level lays, on distinct cells, the same for the same generator", () => {
    for (const level of [1, 2, 4, 10]) {
      const made = newLevel(level, 12_345 + level);
      expect(made.board).toHaveLength(cells);
      expect(runsOf(made.board)).toEqual([]);
      expect(hasMove(made.board)).toBe(true);
      expect(made.frost.filter(Boolean)).toHaveLength(frostFor(level));
      expect(newLevel(level, 12_345 + level)).toEqual(made);
    }
    expect(newLevel(2, 1).frost).not.toEqual(newLevel(2, 2).frost);
  });

  it("begins a run on the first level, with no frost, and with its swaps", () => {
    const state = startRun(7);
    expect([
      state.level,
      state.levelsCleared,
      state.levelScore,
      frosted(state),
      state.moves,
    ]).toEqual([1, 0, 0, 0, firstMoves]);
  });
});

describe("a swap on a level", () => {
  it("adds to the score made on the level, and does not clear it short of the goal", () => {
    const state = startRun(11);
    const next = taken(swapOnce(state, ...first(state)));
    expect(next.levelScore).toBe(next.lastGain);
    expect(next.level).toBe(1);
    expect(next.levelCleared).toBe(false);
  });

  it("clears a score level exactly when the score made reaches the goal, not a point before", () => {
    const state = startRun(11);
    const [cell, to] = first(state);
    const gain = taken(swapOnce(state, cell, to)).lastGain;
    const at = (levelScore: number) =>
      taken(swapOnce({ ...state, levelScore, moves: 5 }, cell, to));
    expect(at(950 - gain).levelCleared).toBe(true);
    expect(at(950 - gain - 1).levelCleared).toBe(false);
  });

  it("on clearing: the next level and its new board and frost, swaps for it and up to three of the leftover, and the leftover paid in points", () => {
    const state = startRun(11);
    const [cell, to] = first(state);
    const gain = taken(swapOnce(state, cell, to)).lastGain;
    const left = (moves: number) =>
      taken(swapOnce({ ...state, levelScore: 950 - gain, moves }, cell, to));
    const cleared = left(9);
    expect([cleared.level, cleared.levelsCleared, cleared.levelScore]).toEqual([
      2, 1, 0,
    ]);
    expect(frosted(cleared)).toBe(frostFor(2));
    expect(cleared.board).not.toEqual(state.board);
    expect(runsOf(cleared.board)).toEqual([]);
    // Nine swaps, one used: eight left, three carried.
    expect(cleared.moves).toBe(movesFor(2) + carryMoves);
    expect(cleared.score).toBe(gain + 8 * leftoverPoints * 1);
    expect(left(2).moves).toBe(movesFor(2) + 1);
    expect(left(1).moves).toBe(movesFor(2));
    expect(left(1).score).toBe(gain);
    expect(cleared.ended).toBe(false);
  });

  it("clears a level on its very last swap, and ends the run if the goal is not reached on it", () => {
    const state = startRun(11);
    const [cell, to] = first(state);
    const gain = taken(swapOnce(state, cell, to)).lastGain;
    const clearing = taken(
      swapOnce({ ...state, levelScore: 950 - gain, moves: 1 }, cell, to),
    );
    expect(clearing.ended).toBe(false);
    expect(clearing.level).toBe(2);
    const short = taken(swapOnce({ ...state, moves: 1 }, cell, to));
    expect([short.ended, short.cause, short.level]).toEqual([true, "out", 1]);
  });
});

describe("frost", () => {
  it("is broken by a swap that clears the cells it lies on, and only those, and clears the level when none is left", () => {
    const state = { ...startRun(11), level: 2, moves: 9 };
    const [cell, to] = first(state);
    const after = taken(swapOnce(state, cell, to));
    const cleared = after.lastCleared;
    const all = state.board.map(() => false);
    const one = all.map((_, at) => at === cleared[0]);
    const lone = taken(swapOnce({ ...state, frost: one }, cell, to));
    expect(lone.levelCleared).toBe(true);
    expect(lone.frostBroken).toBe(1);
    const many = state.board.map(() => true);
    const some = taken(swapOnce({ ...state, frost: many }, cell, to));
    expect(some.frostBroken).toBe(cleared.length);
    expect(frosted(some)).toBe(cells - cleared.length);
    expect(some.levelCleared).toBe(false);
    const away = all.map((_, at) => !cleared.includes(at) && at === 0);
    const untouched = taken(swapOnce({ ...state, frost: away }, cell, to));
    expect(untouched.frostBroken).toBe(0);
    expect(frosted(untouched)).toBe(frosted({ ...state, frost: away }));
  });
});
