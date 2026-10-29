import { describe, expect, it } from "vitest";

import { seeded, startState, stepInt, stepSeed } from "../src/seeded.ts";

describe("the seeded generator", () => {
  it("gives the same numbers for the same seed, always inside [0, 1)", () => {
    const first = seeded(12345);
    const second = seeded(12345);
    const numbers = Array.from({ length: 200 }, () => first());
    expect(Array.from({ length: 200 }, () => second())).toEqual(numbers);
    for (const number of numbers) {
      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThan(1);
    }
    expect(new Set(numbers).size).toBeGreaterThan(190);
  });

  it("follows the 32-bit linear congruential recurrence exactly, so every engine agrees", () => {
    const next = seeded(1);
    const first = (1 * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    const second = (first * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    expect(next()).toBe(first / 4_294_967_296);
    expect(next()).toBe(second / 4_294_967_296);
  });

  it("starts a zero seed from a constant, and does not confuse seeds that differ only above 32 bits", () => {
    expect(startState(0)).toBe(3);
    expect(seeded(0)()).toBe(seeded(3)());
    expect(seeded(1)()).not.toBe(seeded(2)());
    expect(startState(2 ** 32 + 5)).toBe(5);
  });

  it("steps a state kept in a plain value, to the same numbers as the closure", () => {
    const next = seeded(77);
    let state = startState(77);
    for (let at = 0; at < 20; at += 1) {
      const step = stepSeed(state);
      state = step.state;
      expect(step.value).toBe(next());
    }
  });

  it("draws a whole number below a bound, and every number below it turns up", () => {
    let state = startState(9);
    const seen = new Set<number>();
    for (let at = 0; at < 400; at += 1) {
      const step = stepInt(state, 6);
      state = step.state;
      expect(Number.isInteger(step.value)).toBe(true);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(6);
      seen.add(step.value);
    }
    expect(seen.size).toBe(6);
  });
});
