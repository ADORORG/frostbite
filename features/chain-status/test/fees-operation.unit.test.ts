import { chainFeesSchema, type FeeSpeedPolicy } from "@ador/shared/chain";
import { describe, expect, it, vi } from "vitest";

import { createFeesOperation } from "../src/application/fees.ts";

const context = {
  actorSession: null,
  actorUserId: null,
  correlationId: "123e4567-e89b-42d3-a456-426614174000",
};
const feeSpeeds: FeeSpeedPolicy = {
  fast: { approxMinutes: 30, targetBlocks: 3 },
  lightning: { approxMinutes: 15, targetBlocks: 1 },
  medium: { approxMinutes: 60, targetBlocks: 6 },
  slow: { approxMinutes: 250, targetBlocks: 25 },
};
const rates = [
  { satPerVb: 1.009, targetBlocks: 25 },
  { satPerVb: 3, targetBlocks: 6 },
  { satPerVb: 5, targetBlocks: 3 },
  { satPerVb: 9, targetBlocks: 1 },
];
// An everyday step of 200 vB may pay up to 1,000 sats: the usual rates are within that, the 9 sat/vB one is not.
const limit = { exampleVbytes: 200, maxFeeSats: 1_000 };
const status = {
  chain: "bip122:00000000da84f2bafbbc53dee25a72ae",
  indexedHeight: 157_400,
  observedAt: "2026-10-23T12:00:00.000Z",
  tipHeight: 157_401,
};
const followed = (
  over: Partial<
    NonNullable<Parameters<typeof createFeesOperation>[0]["followed"]>
  > = {},
) => ({
  displayName: "Bitcoin testnet4",
  feeRates: async () => rates,
  indexing: async () => status,
  maxFeeSats: limit.maxFeeSats,
  ...over,
});
const answer = (value: Parameters<typeof createFeesOperation>[0]["followed"]) =>
  createFeesOperation({
    exampleVbytes: limit.exampleVbytes,
    feeSpeeds,
    followed: value,
  }).execute({}, context);

describe("the chain fees route", () => {
  it("is public, takes no input, and answers in the shared contract", () => {
    const operation = createFeesOperation({
      exampleVbytes: limit.exampleVbytes,
      feeSpeeds,
      followed: null,
    });
    expect(operation).toMatchObject({
      access: { kind: "public" },
      method: "GET",
      path: "/api/v1/chain/fees",
    });
    expect(operation.outputSchema).toBe(chainFeesSchema);
  });

  it("says there is nothing to show where no chain is followed", async () => {
    expect(await answer(null)).toEqual({ ok: true, value: { state: "none" } });
  });

  it("quotes every speed at its policy's block target with its wait, and says where the chain is", async () => {
    const asked = vi.fn(async () => rates);
    const result = await answer(followed({ feeRates: asked }));
    expect(asked).toHaveBeenCalledWith([25, 6, 3, 1]);
    expect(result).toEqual({
      ok: true,
      value: {
        chain: "Bitcoin testnet4",
        maxFeeSats: 1_000,
        observedAt: status.observedAt,
        quotes: [
          {
            approxMinutes: 250,
            satPerVb: 1.009,
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
        ],
        state: "ok",
        tipHeight: 157_401,
      },
    });
  });

  it("marks the speeds a distorted market prices beyond any step, as testnet4 did at 588,235 sat/vB, while the slow one stays offered", async () => {
    const distorted = [
      { satPerVb: 1.009, targetBlocks: 25 },
      { satPerVb: 588_235.294, targetBlocks: 6 },
      { satPerVb: 588_235.294, targetBlocks: 3 },
      { satPerVb: 588_235.294, targetBlocks: 1 },
    ];
    const result = await answer(followed({ feeRates: async () => distorted }));
    const quotes =
      result.ok && result.value.state === "ok" ? result.value.quotes : [];
    expect(
      quotes.map(({ speed, withinLimit }) => [speed, withinLimit]),
    ).toEqual([
      ["slow", true],
      ["medium", false],
      ["fast", false],
      ["lightning", false],
    ]);
  });

  it("reports the chain as unavailable, never a guessed rate, when it cannot be asked or quotes too little", async () => {
    const unavailable = {
      ok: true,
      value: { chain: "Bitcoin testnet4", state: "unavailable" },
    };
    expect(
      await answer(
        followed({
          feeRates: () => Promise.reject(new Error("the node is down")),
        }),
      ),
    ).toEqual(unavailable);
    expect(
      await answer(
        followed({
          indexing: () => Promise.reject(new Error("the node is down")),
        }),
      ),
    ).toEqual(unavailable);
    expect(
      await answer(followed({ feeRates: async () => rates.slice(1) })),
    ).toEqual(unavailable);
  });
});
