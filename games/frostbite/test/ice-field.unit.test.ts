import { describe, expect, it } from "vitest";

import {
  boardSeedStep,
  cells,
  iceFieldMines,
  iceFieldRules,
  iceFieldVerifierId,
  iceFieldVersion,
  maxBoards,
  maxMines,
  payout,
} from "../src/verifier/ice-field.ts";
import {
  apply,
  input,
  refusal,
  safeTiles,
  start,
} from "./support/ice-field.ts";

describe("the rules' identity", () => {
  it("names itself and its version, which a record must match", () => {
    expect(iceFieldRules.id).toBe(iceFieldVerifierId);
    expect(iceFieldRules.version).toBe(iceFieldVersion);
  });
});

describe("starting a run", () => {
  it("starts on the first board with the game's default mines, and nothing earned", () => {
    const state = start();
    expect(state).toMatchObject({
      boardIndex: 0,
      glacierTier: 0,
      icicles: 0,
      mineCount: 5,
      wins: 0,
    });
    expect(state.board.mines).toEqual(iceFieldMines(7, 0, 5));
    expect(iceFieldRules.earned(state)).toEqual([]);
  });

  it("takes a mine count from 1 to the most that leaves two safe tiles, and nothing else", () => {
    expect(start(1, { mines: 1 }).mineCount).toBe(1);
    expect(start(1, { mines: maxMines }).mineCount).toBe(maxMines);
    for (const mines of [0, maxMines + 1, 1.5, "5", null, -3])
      expect(iceFieldRules.init(1, { mines: mines as never })).toMatchObject({
        ok: false,
      });
    expect(iceFieldRules.init(1, { mode: "fire" })).toEqual({
      ok: false,
      reason: "no such setting: mode",
    });
  });
});

describe("the layout of the field", () => {
  it("is the same for the same seed, board and mine count, and has that many mines", () => {
    expect(iceFieldMines(7, 0, 5)).toEqual(iceFieldMines(7, 0, 5));
    expect(iceFieldMines(7, 0, 5)).toHaveLength(5);
    expect(iceFieldMines(7, 0, 9)).toHaveLength(9);
  });

  it("is another layout for the next board of the same run, from the board's own seed", () => {
    expect(iceFieldMines(7, 1, 5)).not.toEqual(iceFieldMines(7, 0, 5));
    // The step is the game's own (131), written out here rather than read from the constant under test.
    expect(boardSeedStep).toBe(131);
    expect(iceFieldMines(7, 1, 5)).toEqual(iceFieldMines(138, 0, 5));
  });

  it("wraps the board's seed to 32 bits like the game does", () => {
    // 4,294,967,295 + 131 wraps to 130.
    expect(iceFieldMines(4_294_967_295, 1, 5)).toEqual(
      iceFieldMines(130, 0, 5),
    );
  });
});

describe("picking tiles", () => {
  it("banks a safe tile and ends the board on a mine", () => {
    const state = start();
    const [safe] = safeTiles(7, 0);
    const [mine] = state.board.mines;
    const afterSafe = apply(state, input("pick", safe ?? 0));
    expect(afterSafe.board).toMatchObject({ busted: false, picks: [safe] });
    const afterMine = apply(state, input("pick", mine ?? 0));
    expect(afterMine.board.busted).toBe(true);
  });

  it("refuses any pick after a mine, until the board is settled", () => {
    const state = start();
    const busted = apply(state, input("pick", state.board.mines[0] ?? 0));
    expect(refusal(busted, input("pick", safeTiles(7, 0)[0] ?? 0))).toBe(
      "the board is over: settle it",
    );
  });

  it("refuses a tile already picked, one off the field, and anything that is not a whole number", () => {
    const state = start();
    const tile = safeTiles(7, 0)[0] ?? 0;
    const picked = apply(state, input("pick", tile));
    expect(refusal(picked, input("pick", tile))).toBe(
      "that tile is already picked",
    );
    for (const bad of [-1, cells, 99, 1.5, "3", null, true, [1], { a: 1 }])
      expect(refusal(state, input("pick", bad as never))).toBe(
        `pick takes a tile from 0 to ${String(cells - 1)}`,
      );
    expect(refusal(state, { type: "pick" })).toContain("pick takes a tile");
  });
});

describe("settling a board", () => {
  it("pays the safe picks, counts a win, and starts the next board with its own layout", () => {
    const state = start();
    const tiles = safeTiles(7, 0).slice(0, 3);
    const settled = apply(
      state,
      ...tiles.map((t) => input("pick", t)),
      input("settle"),
    );
    expect(settled).toMatchObject({
      boardIndex: 1,
      icicles: payout(3, 5),
      wins: 1,
    });
    expect(settled.board).toMatchObject({ busted: false, picks: [] });
    expect(settled.board.mines).toEqual(iceFieldMines(7, 1, 5));
  });

  it("pays nothing, and counts no win, for a board skipped or busted", () => {
    const state = start();
    const skipped = apply(state, input("settle"));
    expect(skipped).toMatchObject({ boardIndex: 1, icicles: 0, wins: 0 });
    const safe = safeTiles(7, 0)[0] ?? 0;
    const mine = state.board.mines[0] ?? 0;
    const busted = apply(
      state,
      input("pick", safe),
      input("pick", mine),
      input("settle"),
    );
    expect(busted).toMatchObject({ icicles: 0, wins: 0 });
    const bustedFirst = apply(state, input("pick", mine), input("settle"));
    expect(bustedFirst).toMatchObject({ icicles: 0, wins: 0 });
  });

  it("pays the bonus for clearing every safe tile", () => {
    const state = start();
    const cleared = apply(
      state,
      ...safeTiles(7, 0).map((t) => input("pick", t)),
      input("settle"),
    );
    expect(cleared.icicles).toBe(payout(cells - 5, 5));
    expect(cleared.icicles).toBe(Math.round(20 * 50 * 0.55 * 1.5));
    expect(cleared.icicles).toBeGreaterThan(payout(19, 5) * 1.5);
  });

  it("runs out of boards, so a run is bounded however long its record", () => {
    let state = start();
    for (let board = 0; board < maxBoards - 1; board += 1)
      state = apply(state, input("settle"));
    expect(state.boardIndex).toBe(maxBoards - 1);
    expect(refusal(state, input("settle"))).toBe(
      "a run has no more boards after this one",
    );
  });
});

describe("the icicle payout", () => {
  it("is the game's own formula: safe picks x 50 x 0.55, x 1.5 for a clear, rounded", () => {
    // The legacy economy (app.jsx advanceBlock): round(score * ICICLE_BASE * 0.55 * chaos * clearBonus * payMult),
    // with no chaos and a pay multiplier of one.
    expect(payout(1, 5)).toBe(Math.round(1 * 50 * 0.55));
    expect(payout(3, 5)).toBe(83);
    expect(payout(10, 5)).toBe(275);
    expect(payout(20, 5)).toBe(825);
    expect(payout(22, 3)).toBe(Math.round(22 * 50 * 0.55 * 1.5));
    expect(payout(21, 3)).toBe(Math.round(21 * 50 * 0.55));
    expect(payout(0, 5)).toBe(0);
  });
});
