import { describe, expect, it } from "vitest";

import {
  chainOperations,
  milestoneIdSchema,
  transactionIntentSchema,
  transactionSummarySchema,
} from "../src/chain/index.ts";

const chain = "eip155:1";
const other = "eip155:10";
const sender = { chain, value: "0xplayer" };
const contract = { chain, family: "evm", id: "0xrewards" };
const asset = { chain, id: "native", kind: "native" };
const intent = {
  chain,
  contract,
  milestoneId: "first-win",
  operation: "mint-milestone",
  sender,
};
const summary = {
  chain,
  expiresAt: "2026-10-16T12:00:00.000Z",
  fee: { asset, baseUnits: 1n },
  milestone: { contract, id: "first-win" },
  operation: "mint-milestone",
  recipient: sender,
};

describe("the mint-milestone intent", () => {
  it("is an operation the platform performs, so every chain needs a policy for it", () => {
    expect(chainOperations).toContain("mint-milestone");
  });

  it("names a contract and a milestone, and nothing else", () => {
    expect(transactionIntentSchema.safeParse(intent).success).toBe(true);
    expect(
      transactionIntentSchema.safeParse({ ...intent, quantity: 2n }).success,
    ).toBe(false);
    expect(
      transactionIntentSchema.safeParse({ ...intent, milestoneId: undefined })
        .success,
    ).toBe(false);
    expect(
      transactionIntentSchema.safeParse({ ...intent, contract: undefined })
        .success,
    ).toBe(false);
  });

  it.each([
    "x",
    "First Win",
    "-first",
    "first-",
    "a--b",
    "a_b",
    "a".repeat(65),
    "",
  ])("refuses %j as a milestone id", (id) => {
    expect(milestoneIdSchema.safeParse(id).success).toBe(false);
    expect(
      transactionIntentSchema.safeParse({ ...intent, milestoneId: id }).success,
    ).toBe(false);
  });

  it.each(["first-win", "ab", "a".repeat(64), "win-3-boards"])(
    "accepts %j as a milestone id",
    (id) => {
      expect(milestoneIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each([
    ["sender", { sender: { chain: other, value: "0xplayer" } }],
    ["contract", { contract: { ...contract, chain: other } }],
  ])("refuses an intent whose %s belongs to another chain", (_name, change) => {
    expect(
      transactionIntentSchema.safeParse({ ...intent, ...change }).success,
    ).toBe(false);
  });
});

describe("the summary a person checks before signing a claim", () => {
  it("carries the milestone and its contract", () => {
    const parsed = transactionSummarySchema.parse(summary);
    expect(parsed.milestone).toEqual({ contract, id: "first-win" });
    expect(parsed.recipient).toEqual(sender);
  });

  it("refuses a milestone whose contract belongs to another chain, or whose id is not a milestone id", () => {
    expect(
      transactionSummarySchema.safeParse({
        ...summary,
        milestone: { contract: { ...contract, chain: other }, id: "first-win" },
      }).success,
    ).toBe(false);
    expect(
      transactionSummarySchema.safeParse({
        ...summary,
        milestone: { contract, id: "Not An Id" },
      }).success,
    ).toBe(false);
  });

  it("is optional, as every other operation shows none", () => {
    const bare = {
      chain,
      expiresAt: summary.expiresAt,
      fee: summary.fee,
      operation: "mint",
    };
    expect(transactionSummarySchema.safeParse(bare).success).toBe(true);
  });
});
