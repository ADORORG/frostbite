import { describe, expect, it } from "vitest";

import { columns, ticksPerSecond } from "../src/rules/constants.ts";

import {
  idle,
  pressed,
  released,
  repeated,
  repeatDelay,
  repeatEvery,
} from "../src/hands.ts";

describe("a held arrow key", () => {
  it("waits, then repeats at a steady rate until it is let go", () => {
    let hands = pressed("left", 100);
    const fired: number[] = [];
    for (let tick = 100; tick < 140; tick += 1) {
      const step = repeated(hands, tick);
      hands = step.hands;
      if (step.fire !== null) fired.push(tick);
    }
    expect(fired[0]).toBe(100 + repeatDelay);
    expect(fired.slice(1).map((tick, at) => tick - (fired[at] ?? 0))).toEqual(
      fired.slice(1).map(() => repeatEvery),
    );
    expect(fired.length).toBeGreaterThan(5);
  });

  it("says which way it goes, and nothing when no key is down", () => {
    expect(repeated(pressed("right", 0), repeatDelay).fire).toBe("right");
    expect(repeated(pressed("right", 0), repeatDelay - 1).fire).toBeNull();
    expect(repeated(idle, 1_000).fire).toBeNull();
  });

  it("lets the last arrow pressed win, and lets go only of the one that is let go", () => {
    const both = pressed("right", 5);
    expect(both.direction).toBe("right");
    expect(released(both, "left")).toBe(both);
    expect(released(both, "right")).toBe(idle);
  });

  it("feels quick: it starts within a fifth of a second, and a held key crosses the board in well under a second", () => {
    expect(repeatDelay / ticksPerSecond).toBeLessThanOrEqual(0.2);
    expect(repeatEvery / ticksPerSecond).toBeLessThanOrEqual(0.04);
    const crossing = repeatDelay + (columns - 1) * repeatEvery;
    expect(crossing / ticksPerSecond).toBeLessThan(0.5);
    expect(repeatEvery).toBeGreaterThanOrEqual(1);
  });
});
