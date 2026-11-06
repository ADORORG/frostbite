import { describe, expect, it } from "vitest";

import {
  loopTime,
  scroll,
  pickRandom,
  pickStable,
  stillFraction,
  stillTime,
} from "../src/engine/index.ts";

describe("loop time", () => {
  it("wraps any time into the loop, backwards too", () => {
    expect(loopTime(25, 20)).toBe(5);
    expect(loopTime(20, 20)).toBe(0);
    expect(loopTime(-3, 20)).toBe(17);
    expect(loopTime(7.5, 20)).toBe(7.5);
  });

  it("draws a still frame far enough into the loop for something to be happening", () => {
    expect(stillTime(20)).toBe(20 * stillFraction);
    expect(stillFraction).toBeGreaterThan(0.3);
    expect(stillFraction).toBeLessThan(0.9);
  });
});

describe("scrolling", () => {
  it("goes at its speed and starts over every repeat, so a whole number of repeats closes a loop", () => {
    expect(scroll(1, 8, 160)).toBe(8);
    expect(scroll(20, 8, 160)).toBe(0);
    expect(scroll(21, 8, 160)).toBe(8);
  });
});

describe("picking a scene at random", () => {
  it("never takes one that is taken while another is free", () => {
    for (let run = 0; run < 50; run += 1)
      expect([0, 2, 3]).not.toContain(pickRandom(5, [0, 2, 3]));
  });

  it("chooses among the free ones by the random number it is given", () => {
    expect(pickRandom(4, [1], () => 0)).toBe(0);
    expect(pickRandom(4, [1], () => 0.34)).toBe(2);
    expect(pickRandom(4, [1], () => 0.99)).toBe(3);
  });

  it("allows a repeat once every scene is taken, rather than failing", () => {
    expect(pickRandom(2, [0, 1], () => 0.99)).toBe(1);
  });

  it("falls back to the first when there is nothing to choose from", () => {
    expect(pickRandom(0, [], () => 0.5)).toBe(0);
  });
});

describe("picking a scene from an id", () => {
  it("gives the same answer every time, inside the range", () => {
    expect(pickStable("example-game", 8)).toBe(pickStable("example-game", 8));
    for (const id of ["a", "b", "example-game", ""])
      expect(pickStable(id, 8)).toBeLessThan(8);
  });

  it("does not put ids that differ by a letter on one scene", () => {
    const ids = [
      "sample-tap",
      "sample-sky",
      "sample-run",
      "sample-grid",
      "sample-yard",
      "col-a",
      "col-b",
      "col-c",
    ];
    expect(
      new Set(ids.map((id) => pickStable(id, 8))).size,
    ).toBeGreaterThanOrEqual(6);
  });
});
