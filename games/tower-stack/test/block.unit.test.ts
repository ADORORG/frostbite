import { describe, expect, it } from "vitest";

import {
  blockX,
  rangeOf,
  speedFor,
  sweepPosition,
} from "../src/rules/block.ts";
import {
  fieldWidth,
  speedStepLevels,
  startSpeed,
  topSpeed,
} from "../src/rules/constants.ts";
import { tower } from "./support/states.ts";

describe("the sweep of a block", () => {
  it("goes from one end of its range to the other and back, a triangle of the distance travelled", () => {
    const at = (elapsed: number) => sweepPosition(0, 1, elapsed, 10);
    expect([0, 1, 5, 10].map(at)).toEqual([0, 1, 5, 10]);
    expect([11, 15, 19, 20, 21].map(at)).toEqual([9, 5, 1, 0, 1]);
  });

  it("starts where its phase says and moves as fast as its speed", () => {
    expect(sweepPosition(4, 1, 0, 10)).toBe(4);
    expect(sweepPosition(4, 3, 2, 10)).toBe(10);
    expect(sweepPosition(4, 3, 3, 10)).toBe(7);
  });

  it("stays where it is when it has no room to move", () => {
    expect(sweepPosition(5, 2, 9, 0)).toBe(0);
    expect(sweepPosition(5, 2, 9, -3)).toBe(0);
  });
});

describe("how fast the block goes", () => {
  it("starts slow, goes a unit faster every few blocks, and stops at the top speed", () => {
    expect(speedFor(0)).toBe(startSpeed);
    expect(speedFor(speedStepLevels - 1)).toBe(startSpeed);
    expect(speedFor(speedStepLevels)).toBe(startSpeed + 1);
    expect(speedFor(speedStepLevels * 2)).toBe(startSpeed + 2);
    expect(speedFor(10_000)).toBe(topSpeed);
  });

  it("is never faster than the perfect window is wide, so a perfect drop can always be met", () => {
    // A block moving `topSpeed` units a tick lands on every `topSpeed`th unit at worst; the window is wider than that.
    expect(topSpeed).toBeLessThan(2 * 3 + 1);
  });
});

describe("where the block is", () => {
  it("is the sweep of its own range, counted from the tick it appeared on", () => {
    const state = tower({ phase: 10, startTick: 100, width: 100 });
    expect(rangeOf(state.width)).toBe(fieldWidth - 100);
    expect(blockX(state, 100)).toBe(10);
    expect(blockX(state, 105)).toBe(15);
    expect(blockX(state, 110)).toBe(20);
  });

  it("turns back at the end of its range, which a wider block reaches sooner", () => {
    const narrow = tower({ phase: 0, width: 20 });
    const wide = tower({ phase: 0, width: 100 });
    expect(blockX(narrow, 100)).toBe(100);
    expect(blockX(narrow, 110)).toBe(90);
    expect(blockX(wide, 25)).toBe(15);
  });
});
