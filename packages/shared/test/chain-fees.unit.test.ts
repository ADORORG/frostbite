import { describe, expect, it } from "vitest";

import {
  assertFeeSpeedPolicy,
  chainFeesSchema,
  feeAtRate,
  feeSpeeds,
  quotesFor,
  targetBlocksOf,
  type FeeSpeedPolicy,
} from "../src/chain/fees.ts";

const policy: FeeSpeedPolicy = {
  fast: { approxMinutes: 30, targetBlocks: 3 },
  lightning: { approxMinutes: 15, targetBlocks: 1 },
  medium: { approxMinutes: 60, targetBlocks: 6 },
  slow: { approxMinutes: 250, targetBlocks: 25 },
};

describe("the fee speeds", () => {
  it("are slow, medium, fast and lightning, in that order", () => {
    expect(feeSpeeds).toEqual(["slow", "medium", "fast", "lightning"]);
  });

  it("stand for the block targets the policy gives them", () => {
    expect(feeSpeeds.map((speed) => targetBlocksOf(policy, speed))).toEqual([
      25, 6, 3, 1,
    ]);
  });
});

describe("a fee speed policy", () => {
  it("is accepted when each speed is faster than the one before", () => {
    expect(() => assertFeeSpeedPolicy(policy)).not.toThrow();
  });

  it.each([
    [
      "a zero block target",
      { ...policy, fast: { approxMinutes: 30, targetBlocks: 0 } },
    ],
    [
      "a fractional block target",
      { ...policy, fast: { approxMinutes: 30, targetBlocks: 2.5 } },
    ],
    ["a zero wait", { ...policy, fast: { approxMinutes: 0, targetBlocks: 3 } }],
    [
      "a speed that is not faster in blocks",
      { ...policy, medium: { approxMinutes: 60, targetBlocks: 25 } },
    ],
    [
      "a speed that is not faster in time",
      { ...policy, medium: { approxMinutes: 250, targetBlocks: 6 } },
    ],
    [
      "two speeds on one target",
      { ...policy, lightning: { approxMinutes: 15, targetBlocks: 3 } },
    ],
  ])("is refused with %s", (_name, bad) => {
    expect(() => assertFeeSpeedPolicy(bad)).toThrow();
  });
});

describe("the quotes for the speeds", () => {
  const rates = [
    { satPerVb: 1.5, targetBlocks: 25 },
    { satPerVb: 3, targetBlocks: 6 },
    { satPerVb: 5, targetBlocks: 3 },
    { satPerVb: 9, targetBlocks: 1 },
  ];

  // An everyday step of 200 vB may pay 1,000 sats: 5 sat/vB is exactly that, 9 is over.
  const limit = { smallestStepVbytes: 200, maxFeeSats: 1_000 };

  it("pair each speed with the rate for its target and the wait the policy tells, and say whether any step could afford it", () => {
    expect(quotesFor(policy, rates, limit)).toEqual([
      {
        approxMinutes: 250,
        satPerVb: 1.5,
        speed: "slow",
        targetBlocks: 25,
        withinLimit: true,
      },
      {
        approxMinutes: 60,
        satPerVb: 3,
        speed: "medium",
        targetBlocks: 6,
        withinLimit: true,
      },
      {
        approxMinutes: 30,
        satPerVb: 5,
        speed: "fast",
        targetBlocks: 3,
        withinLimit: true,
      },
      {
        approxMinutes: 15,
        satPerVb: 9,
        speed: "lightning",
        targetBlocks: 1,
        withinLimit: false,
      },
    ]);
  });

  it("count a rate that costs one satoshi more than the limit as over it", () => {
    const over = quotesFor(
      policy,
      [{ satPerVb: 5.005, targetBlocks: 25 }, ...rates.slice(1)],
      limit,
    );
    expect(over?.map((quote) => quote.withinLimit)).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });

  it("are none, rather than a guess, when the node quoted no rate for a speed's target", () => {
    expect(quotesFor(policy, rates.slice(1), limit)).toBeNull();
  });

  it("have a cost that never rounds below what is needed", () => {
    expect(feeAtRate(1.009, 200)).toBe(202);
    expect(feeAtRate(2, 100.5)).toBe(201);
    expect(feeAtRate(1, 0)).toBe(0);
  });
});

describe("the public fees answer", () => {
  const quotes = [
    { approxMinutes: 250, satPerVb: 1, speed: "slow", targetBlocks: 25 },
    { approxMinutes: 60, satPerVb: 2, speed: "medium", targetBlocks: 6 },
    { approxMinutes: 30, satPerVb: 3, speed: "fast", targetBlocks: 3 },
    { approxMinutes: 15, satPerVb: 4, speed: "lightning", targetBlocks: 1 },
  ].map((quote) => ({ ...quote, withinLimit: true }));
  const ok = {
    chain: "Bitcoin testnet4",
    maxFeeSats: 500_000,
    observedAt: "2026-10-23T12:00:00.000Z",
    quotes,
    state: "ok",
    tipHeight: 157400,
  };

  it("is none, unavailable or a reading with all four quotes", () => {
    expect(chainFeesSchema.parse({ state: "none" })).toEqual({ state: "none" });
    expect(
      chainFeesSchema.parse({
        chain: "Bitcoin testnet4",
        state: "unavailable",
      }),
    ).toBeDefined();
    expect(chainFeesSchema.parse(ok)).toEqual(ok);
  });

  it("refuses a reading with too few quotes, a free rate, or a field it does not know", () => {
    for (const bad of [
      { ...ok, quotes: quotes.slice(1) },
      { ...ok, quotes: [{ ...quotes[0], satPerVb: 0 }, ...quotes.slice(1)] },
      { ...ok, extra: 1 },
      { ...ok, maxFeeSats: 0 },
      {
        ...ok,
        quotes: [{ ...quotes[0], withinLimit: undefined }, ...quotes.slice(1)],
      },
    ]) {
      expect(() => chainFeesSchema.parse(bad)).toThrow();
    }
  });
});
