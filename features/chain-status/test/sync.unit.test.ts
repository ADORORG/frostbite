import { describe, expect, it } from "vitest";

import { syncProgress } from "../src/domain/sync.ts";

const at = (indexedHeight: number, tipHeight: number, window = 100) =>
  syncProgress({ indexedHeight, tipHeight }, window);

describe("how far along the reading of the chain is", () => {
  it("is full only at the tip, and counts each block behind against the window", () => {
    expect(at(1_000, 1_000)).toBe(1);
    expect(at(999, 1_000)).toBeCloseTo(0.99);
    expect(at(950, 1_000)).toBeCloseTo(0.5);
    expect(at(328_138, 328_178)).toBeCloseTo(0.6);
  });

  it("is empty a whole window behind or more, and never below it", () => {
    expect(at(900, 1_000)).toBe(0);
    expect(at(0, 1_000_000)).toBe(0);
  });

  it("is full for an indexer reported ahead of the tip, and for a chain at block zero", () => {
    expect(at(1_005, 1_000)).toBe(1);
    expect(at(0, 0)).toBe(1);
  });

  it("spans the window it is given", () => {
    expect(at(990, 1_000, 10)).toBe(0);
    expect(at(995, 1_000, 10)).toBeCloseTo(0.5);
  });
});
