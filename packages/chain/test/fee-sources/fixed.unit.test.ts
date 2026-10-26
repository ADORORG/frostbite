import { describe, expect, it } from "vitest";

import { createFixedFeeSource } from "../../src/fee-sources/fixed.ts";

describe("a fee rate the operator set", () => {
  it("is the rate for every confirmation target, as many as are asked", async () => {
    expect(await createFixedFeeSource(2.5).feeRates([1, 3, 25])).toEqual([
      { satPerVb: 2.5, targetBlocks: 1 },
      { satPerVb: 2.5, targetBlocks: 3 },
      { satPerVb: 2.5, targetBlocks: 25 },
    ]);
    expect(await createFixedFeeSource(1).feeRates([])).toEqual([]);
  });

  it("refuses a rate that is not a positive number, when it is made and not at the first step", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => createFixedFeeSource(bad)).toThrow(
        "positive number of sat/vB",
      );
  });
});
