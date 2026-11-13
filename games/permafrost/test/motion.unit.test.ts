import { describe, expect, it } from "vitest";

import { advance } from "../src/rules/advance.ts";
import { columns, rows } from "../src/rules/constants.ts";
import { gravityFor, lockDelayFor } from "../src/rules/difficulty.ts";
import { newPiece } from "../src/rules/lock.ts";
import { startRun } from "../src/rules/state.ts";
import { press } from "./support/drive.ts";
import { stateWith } from "./support/states.ts";

const floor = { ...newPiece(1), y: rows - 2 };

describe("a piece falling", () => {
  it("is the same for the same seed, and shows the first piece of the bag in hand", () => {
    expect(startRun(3)).toEqual(startRun(3));
    expect(startRun(3).queue.length).toBeGreaterThan(6);
    const firsts = new Set(
      Array.from(
        { length: 60 },
        (_, at) => startRun(Math.imul(at + 1, 2_654_435_761) >>> 0).piece.kind,
      ),
    );
    expect(firsts.size).toBeGreaterThan(3);
    expect([...firsts].every((kind) => kind >= 1 && kind <= 7)).toBe(true);
  });

  it("sinks a row when the level's time has passed, and not before", () => {
    const wait = gravityFor(1);
    const start = startRun(1);
    expect(advance(start, wait - 1).piece.y).toBe(start.piece.y);
    expect(advance(start, wait).piece.y).toBe(start.piece.y + 1);
    expect(advance(start, wait * 3).piece.y).toBe(start.piece.y + 3);
    expect(advance(start, 0)).toBe(start);
  });

  it("falls faster while the soft drop is held, one point a row, and slows when it is let go", () => {
    const held = advance(press(startRun(1), "s"), 20);
    expect(held.piece.y).toBe(startRun(1).piece.y + 10);
    expect(held.score).toBe(10);
    const let_go = advance(press(held, "S"), 40);
    expect(let_go.piece.y).toBeLessThan(held.piece.y + 2);
    expect(let_go.score).toBe(10);
  });

  it("moves a column at a time, and a move into a wall changes nothing", () => {
    const start = startRun(1);
    expect(press(start, "l").piece.x).toBe(start.piece.x - 1);
    expect(press(start, "r").piece.x).toBe(start.piece.x + 1);
    const wall = press(stateWith({}, 3), "llllll");
    expect(wall.piece.x).toBe(0);
    expect(press(wall, "l")).toEqual(wall);
    const right = press(stateWith({}, 3), "r".repeat(9));
    expect(right.piece.x).toBe(columns - 3);
  });

  it("turns both ways, and is kicked off a wall or the stack when it would not fit", () => {
    const turned = press(stateWith({}, 3), "a");
    expect(turned.piece.rotation).toBe(1);
    expect(press(turned, "b").piece.rotation).toBe(0);
    expect(press(stateWith({}, 3), "aaaa").piece.rotation).toBe(0);
    const upright = press(stateWith({}, 1), "a");
    const atWall = press(upright, "l".repeat(9));
    const kicked = press(atWall, "b");
    expect(kicked.piece.rotation).toBe(0);
    expect(kicked.piece.x).toBeGreaterThanOrEqual(-3);
  });

  it("leaves a piece as it was when no kick lets it turn", () => {
    const cramped = stateWith(
      { piece: { ...newPiece(1), rotation: 1, x: 7, y: 2 } },
      1,
    );
    const crowded = {
      ...cramped,
      board: cramped.board.map((_, at) =>
        at % columns === 8 || at % columns === 9 ? 0 : 8,
      ),
    };
    expect(press(crowded, "a").piece.rotation).toBe(crowded.piece.rotation);
  });
});

describe("a piece coming to rest", () => {
  it("sets once it has rested for the level's delay, and not a tick before", () => {
    const resting = stateWith({ piece: floor });
    const delay = lockDelayFor(1);
    const before = advance(resting, delay - 1);
    expect(before.board.some((cell) => cell !== 0)).toBe(false);
    expect(before.piece.grounded).toBe(delay - 1);
    const after = advance(resting, delay);
    expect(after.board.filter((cell) => cell === 1)).toHaveLength(4);
    expect(after.piece.y).toBeLessThan(floor.y);
  });

  it("puts off setting for a move, but only fifteen times", () => {
    let state = stateWith({ piece: floor });
    for (let at = 0; at < 15; at += 1) {
      state = press(advance(state, state.tick + 10), at % 2 === 0 ? "l" : "r");
      expect(state.piece.grounded).toBe(0);
    }
    expect(state.piece.resets).toBe(15);
    const slid = press(advance(state, state.tick + 10), "l");
    expect(slid.piece.grounded).toBe(10);
    expect(
      advance(slid, slid.tick + lockDelayFor(1)).board.some((c) => c !== 0),
    ).toBe(true);
  });

  it("starts its rest afresh when it sinks to a new row", () => {
    const state = stateWith({
      piece: { ...floor, grounded: 5, resets: 9, y: rows - 3 },
    });
    const sunk = advance(state, gravityFor(1));
    expect(sunk.piece.y).toBe(rows - 2);
    expect(sunk.piece.resets).toBe(0);
  });
});

describe("holding and dropping", () => {
  it("holds the piece and brings out the next, once for each piece", () => {
    const start = startRun(5);
    const next = start.queue[0];
    const held = press(start, "h");
    expect(held.hold).toBe(start.piece.kind);
    expect(held.piece.kind).toBe(next);
    expect(held.holds).toBe(1);
    expect(press(held, "h")).toEqual(held);
  });

  it("swaps with the piece held after the next one is set, and puts the new piece back at the top", () => {
    const start = startRun(5);
    const held = press(start, "h");
    const second = press(held, "d");
    expect(second.holdUsed).toBe(false);
    const swapped = press(second, "h");
    expect(swapped.piece.kind).toBe(start.piece.kind);
    expect(swapped.hold).toBe(second.piece.kind);
    expect(swapped.piece.y).toBe(newPiece(1).y);
  });

  it("drops a piece to the bottom at once, two points a row, and brings in the next", () => {
    const start = stateWith({}, 1);
    const dropped = press(start, "d");
    expect(dropped.board.filter((cell) => cell === 1)).toHaveLength(4);
    expect(dropped.score).toBe(2 * (rows - 2 - start.piece.y));
    expect(dropped.piece.y).toBe(newPiece(1).y);
    expect(dropped.queue.length).toBeGreaterThanOrEqual(7);
  });

  it("does nothing once the stack has reached the top", () => {
    const stuck = { ...startRun(2), blocked: true };
    expect(press(stuck, "ld").piece).toEqual(stuck.piece);
    expect(press(stuck, "d").board).toEqual(stuck.board);
  });
});
