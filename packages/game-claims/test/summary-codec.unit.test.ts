import { transactionSummarySchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { decodeSummary, encodeSummary } from "../src/summary-codec.ts";

const chain = "simnet:one";
const asset = { chain, id: "sim", kind: "native" } as const;
const contract = { chain, family: "simulated", id: "rewards-1" };
const sender = { chain, value: "sim:one:a1b2c3" };

const summary = transactionSummarySchema.parse({
  amount: { asset, baseUnits: 12_345_678_901_234_567_890n },
  chain,
  expiresAt: "2026-10-16T13:00:00.000Z",
  fee: { asset, baseUnits: 1n },
  milestone: { contract, id: "first-win" },
  operation: "mint-milestone",
  recipient: sender,
});

describe("a stored summary", () => {
  it("is plain JSON, with amounts as decimal text", () => {
    const stored = encodeSummary(summary);
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
    expect(stored).toMatchObject({
      amount: { baseUnits: "12345678901234567890" },
      fee: { baseUnits: "1" },
    });
  });

  it("comes back as it went in, amounts above the safe integer range included", () => {
    expect(decodeSummary(encodeSummary(summary))).toEqual(summary);
  });

  it("is checked on the way out: stored text that is not a summary is refused", () => {
    expect(() => decodeSummary({ chain })).toThrow();
    const stored = encodeSummary(summary) as { fee: { baseUnits: string } };
    expect(() =>
      decodeSummary({ ...stored, fee: { ...stored.fee, baseUnits: "-1" } }),
    ).toThrow();
  });

  it("reads a summary with no amount or milestone", () => {
    const bare = transactionSummarySchema.parse({
      chain,
      expiresAt: summary.expiresAt,
      fee: summary.fee,
      operation: "mint",
    });
    expect(decodeSummary(encodeSummary(bare))).toEqual(bare);
  });
});
