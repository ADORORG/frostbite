import { describe, expect, it } from "vitest";

import { pickDistinct, seeded } from "../src/verifier/seeded.ts";

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
    // state' = (state * 1664525 + 1013904223) mod 2^32, from seed 1, written out by hand.
    const next = seeded(1);
    const first = (1 * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    const second = (first * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    expect(next()).toBe(first / 4_294_967_296);
    expect(next()).toBe(second / 4_294_967_296);
  });

  it("starts a zero seed from a constant, and does not confuse seeds that differ only above 32 bits", () => {
    expect(seeded(0)()).toBe(seeded(3)());
    expect(seeded(1)()).not.toBe(seeded(2)());
  });
});

describe("choosing distinct cells", () => {
  it("chooses exactly the number asked for, distinct, in range and sorted", () => {
    for (const seed of [0, 1, 99, 4_294_967_295]) {
      for (const count of [0, 1, 5, 23, 25]) {
        const chosen = pickDistinct(seed, 25, count);
        expect(chosen).toHaveLength(count);
        expect(new Set(chosen).size).toBe(count);
        expect([...chosen].sort((a, b) => a - b)).toEqual(chosen);
        for (const cell of chosen) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(25);
        }
      }
    }
  });

  it("is the same for the same seed and different for others", () => {
    expect(pickDistinct(7, 25, 5)).toEqual(pickDistinct(7, 25, 5));
    const layouts = new Set(
      Array.from({ length: 50 }, (_, seed) => pickDistinct(seed, 25, 5).join()),
    );
    expect(layouts.size).toBeGreaterThan(40);
  });

  it("can take every cell, and it terminates even for the worst seeds", () => {
    expect(pickDistinct(5, 25, 25)).toEqual(
      Array.from({ length: 25 }, (_, i) => i),
    );
    for (const seed of [0, 3, 2_147_483_648, 4_294_967_295])
      expect(pickDistinct(seed, 25, 23)).toHaveLength(23);
  });
});
