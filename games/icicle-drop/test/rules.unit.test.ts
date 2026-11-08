import { replayRecord } from "@frostbite/game-sdk/replay";
import { describe, expect, it } from "vitest";

import { maxMoves } from "../src/rules/constants.ts";
import { dropRules } from "../src/rules/index.ts";
import { earnedBy, milestoneIds } from "../src/rules/milestones.ts";
import { moveOnce } from "../src/rules/move.ts";
import { spawn, startDrop, type DropState } from "../src/rules/state.ts";
import { play } from "./support/bot.ts";

const started = (seed = 7): DropState => startDrop(seed);

describe("a fresh run", () => {
  it("starts with two tiles, a 2 or a 4, and nothing earned", () => {
    const run = started();
    const tiles = run.board.filter((level) => level > 0);
    expect(tiles).toHaveLength(2);
    for (const level of tiles) expect([1, 2]).toContain(level);
    expect(run.moves).toBe(0);
    expect(earnedBy(run)).toEqual([]);
  });

  it("is the same board for the same seed, and another for another", () => {
    expect(started(7)).toEqual(started(7));
    expect(started(7).board).not.toEqual(started(8).board);
  });

  it("puts a new tile on an empty cell only, a 2 far more often than a 4", () => {
    let board: readonly number[] = Array.from({ length: 16 }, () => 0);
    let generator = 11;
    const levels: number[] = [];
    for (let at = 0; at < 16; at += 1) {
      const placed = spawn(board, generator);
      const newCells = placed.board.flatMap((level, cell) =>
        level !== board[cell] ? [cell] : [],
      );
      expect(newCells).toHaveLength(1);
      expect(board[newCells[0] ?? 0]).toBe(0);
      levels.push(placed.board[newCells[0] ?? 0] ?? 0);
      board = placed.board;
      generator = placed.generator;
    }
    expect(levels.every((level) => level === 1 || level === 2)).toBe(true);
    expect(levels.filter((level) => level === 1).length).toBeGreaterThan(10);
  });
});

describe("a move", () => {
  const packed: DropState = {
    ...started(),
    board: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  it("refuses one that changes nothing, and counts one that does", () => {
    expect(moveOnce(packed, "left")).toBeNull();
    expect(moveOnce(packed, "up")).toBeNull();
    const moved = moveOnce(packed, "right");
    expect(moved?.moves).toBe(1);
    expect(moved?.board.filter((level) => level > 0)).toHaveLength(3);
  });

  it("keeps the score, the merges and the most joined in one move", () => {
    const state: DropState = {
      ...started(),
      board: [1, 1, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    const next = moveOnce(state, "left");
    expect(next?.score).toBe(4 + 8);
    expect(next?.merges).toBe(2);
    expect(next?.mostMerges).toBe(2);
    expect(next?.streak).toBe(1);
    expect(next?.bestStreak).toBe(1);
  });

  it("ends a streak with a move that joins nothing, and remembers the best", () => {
    const state: DropState = {
      ...started(),
      board: [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bestStreak: 4,
      streak: 3,
    };
    const next = moveOnce(state, "down");
    expect(next?.streak).toBe(0);
    expect(next?.bestStreak).toBe(4);
  });

  it("notes the move on which each level is first reached, and never changes it afterwards", () => {
    const state: DropState = {
      ...started(),
      board: [6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      moves: 40,
    };
    const next = moveOnce(state, "left");
    expect(next?.reachedAt[7]).toBe(41);
    expect(next?.reachedAt[6]).toBe(41);
    const again =
      next === null
        ? null
        : moveOnce(
            { ...next, board: [7, 7, 0, 0, ...next.board.slice(4)] },
            "left",
          );
    expect(again?.reachedAt[7]).toBe(41);
    expect(again?.reachedAt[8]).toBe(42);
  });

  it("is over when no move is left, and when a run has held as many moves as it may", () => {
    const stuck: DropState = {
      ...started(),
      board: [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 0],
    };
    expect(moveOnce(stuck, "right")?.over).toBe(false);
    const last =
      moveOnce({ ...started(), moves: maxMoves - 1 }, "left") ??
      moveOnce({ ...started(), moves: maxMoves - 1 }, "down");
    expect(last?.over).toBe(true);
    const dead: DropState = {
      ...started(),
      board: [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 0],
    };
    const filled = moveOnce(dead, "right");
    expect(filled).not.toBeNull();
  });
});

describe("the marks", () => {
  const withTiles = (tiles: Record<number, number>): DropState => ({
    ...started(),
    board: Array.from({ length: 16 }, (_, at) => tiles[at] ?? 0),
  });

  it("notes a biggest tile of 256 or more once it sits in a corner, and not before", () => {
    expect(moveOnce(withTiles({ 5: 8 }), "left")?.cornerKing).toBe(false);
    expect(moveOnce(withTiles({ 1: 8 }), "left")?.cornerKing).toBe(true);
    expect(moveOnce(withTiles({ 5: 8, 6: 1 }), "up")?.cornerKing).toBe(false);
  });

  it("does not note a tile below 256 in a corner, nor a corner that holds a small tile beside a bigger one", () => {
    expect(moveOnce(withTiles({ 1: 7 }), "left")?.cornerKing).toBe(false);
    expect(moveOnce(withTiles({ 1: 8, 2: 9 }), "left")?.cornerKing).toBe(false);
  });

  it("keeps a mark once it is earned", () => {
    const earned = {
      ...withTiles({ 1: 8 }),
      cornerKing: true,
      spacious: true,
      closeShave: true,
    };
    const next = moveOnce(earned, "left");
    expect(next).toMatchObject({
      cornerKing: true,
      closeShave: true,
      spacious: true,
    });
  });

  it("notes a 128 held with half the board empty, and not with fewer empty", () => {
    expect(moveOnce(withTiles({ 0: 7, 4: 1 }), "right")?.spacious).toBe(true);
    const crowded = withTiles({
      0: 7,
      1: 1,
      2: 2,
      3: 3,
      4: 1,
      5: 2,
      6: 3,
      7: 4,
      8: 2,
      9: 3,
      10: 4,
      11: 5,
    });
    expect(moveOnce(crowded, "down")?.spacious).toBe(false);
  });

  it("counts half the board empty as room to spare, and one fewer as not", () => {
    const eight = withTiles({ 0: 7, 4: 1, 5: 2, 6: 3, 7: 4, 8: 2, 9: 3 });
    const next = moveOnce(eight, "right");
    expect(next?.board.filter((level) => level === 0)).toHaveLength(8);
    expect(next?.spacious).toBe(true);
    const fewer = withTiles({
      0: 7,
      4: 1,
      5: 2,
      6: 3,
      7: 4,
      8: 2,
      9: 3,
      10: 1,
    });
    const crowded = moveOnce(fewer, "right");
    expect(crowded?.board.filter((level) => level === 0)).toHaveLength(7);
    expect(crowded?.spacious).toBe(false);
  });

  it("notes a full board that still has a move", () => {
    const nearly = withTiles({
      0: 1,
      1: 2,
      2: 1,
      3: 2,
      4: 2,
      5: 1,
      6: 2,
      7: 1,
      8: 1,
      9: 2,
      10: 1,
      11: 2,
      12: 2,
      13: 1,
      14: 2,
    });
    const next = moveOnce(nearly, "right");
    expect(next?.board.every((level) => level > 0)).toBe(true);
    expect(next?.closeShave).toBe(true);
    expect(moveOnce(withTiles({ 5: 1 }), "left")?.closeShave).toBe(false);
  });
});

describe("the rules as a verifier", () => {
  it("starts from a seed and no settings", () => {
    expect(dropRules.init(5, {}).ok).toBe(true);
    expect(dropRules.init(5, { size: 5 })).toEqual({
      ok: false,
      reason: "no such setting: size",
    });
  });

  it("refuses what is not a move: an unknown input, data on a move, a move that does nothing, and a move after the end", () => {
    const run = dropRules.init(7, {});
    if (!run.ok) throw new Error("init");
    const state = run.state;
    expect(dropRules.step(state, { type: "jump" })).toEqual({
      ok: false,
      reason: "no such input: jump",
    });
    expect(dropRules.step(state, { data: 1, type: "left" })).toEqual({
      ok: false,
      reason: "a move takes no data",
    });
    expect(dropRules.step(state, { data: {}, type: "end" })).toEqual({
      ok: false,
      reason: "a move takes no data",
    });
    const ended = dropRules.step(state, { type: "end" });
    if (!ended.ok) throw new Error("end");
    expect(dropRules.step(ended.state, { type: "left" })).toEqual({
      ok: false,
      reason: "the run has ended",
    });
    const packed = {
      ...state,
      board: [1, 2, ...Array.from({ length: 14 }, () => 0)],
    };
    expect(dropRules.step(packed, { type: "left" })).toEqual({
      ok: false,
      reason: "that move changes nothing",
    });
  });

  it("allows only the end once no move is left", () => {
    const run = started();
    const dead: DropState = {
      ...run,
      board: [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1],
      over: true,
    };
    expect(dropRules.step(dead, { type: "left" })).toEqual({
      ok: false,
      reason: "no move is left",
    });
    expect(dropRules.step(dead, { type: "end" }).ok).toBe(true);
  });

  it("replays a played run to the milestones the player earned, and every id it names is declared", () => {
    const { inputs, state } = play(5, 400);
    const outcome = replayRecord(dropRules, {
      claims: [],
      config: {},
      gameId: "icicle-drop",
      inputs: [...inputs],
      schemaVersion: 1,
      seed: 5,
      verifier: "icicle-drop",
      verifierVersion: 1,
    });
    expect(outcome).toMatchObject({ earned: earnedBy(state), ok: true });
    for (const id of earnedBy(state)) expect(milestoneIds).toContain(id);
    expect(earnedBy(state).length).toBeGreaterThan(8);
  });
});
