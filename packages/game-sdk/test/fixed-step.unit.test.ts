import { describe, expect, it } from "vitest";

import { mostTicksAFrame, ticksIn } from "../src/fixed-step.ts";

const rate = 30;
const frame = 1000 / rate;

describe("turning time into ticks", () => {
  it("gives whole ticks and carries the remainder to the next frame", () => {
    expect(ticksIn(0, frame * 2.5, rate).ticks).toBe(2);
    const second = ticksIn(
      ticksIn(0, frame * 2.5, rate).carried,
      frame * 0.6,
      rate,
    );
    expect(second.ticks).toBe(1);
  });

  it("gives none for less than a tick, and keeps what elapsed", () => {
    expect(ticksIn(0, 5, rate).ticks).toBe(0);
    expect(ticksIn(0, 5, rate).carried).toBeCloseTo(5);
  });

  it("never runs backwards", () => {
    expect(ticksIn(0, -50, rate)).toEqual({ carried: 0, ticks: 0 });
  });

  it("cuts a long pause short instead of running the game into a wall", () => {
    expect(ticksIn(0, 60_000, rate)).toEqual({
      carried: 0,
      ticks: mostTicksAFrame,
    });
  });

  it("follows the rate it is given", () => {
    expect(ticksIn(0, 1000, 2).ticks).toBe(2);
    expect(ticksIn(0, 1000, 4).ticks).toBe(4);
  });
});
