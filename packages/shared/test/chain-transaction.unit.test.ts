import { describe, expect, it } from "vitest";

import {
  broadcastOutcomeSchema,
  observationSchema,
  signedTransactionSchema,
  transactionIntentSchema,
  transactionSummarySchema,
  unsignedTransactionSchema,
} from "../src/chain/index.ts";

function without<T extends object>(value: T, key: keyof T): object {
  return Object.fromEntries(
    Object.entries(value).filter(([name]) => name !== key),
  );
}

const chain = "eip155:1";
const other = "eip155:10";
const sender = { chain, value: "0xsender" };
const recipient = { chain, value: "0xrecipient" };
const asset = { chain, id: "native", kind: "native" };
const amount = { asset, baseUnits: 5n };
const contract = { chain, family: "evm", id: "0xcontract" };
const summary = {
  amount,
  chain,
  expiresAt: "2026-10-09T12:00:00.000Z",
  fee: { asset, baseUnits: 1n },
  operation: "transfer",
  recipient,
};

describe("transactionIntentSchema", () => {
  const intents = [
    {
      chain,
      operation: "deploy",
      sender,
      templateId: "collection",
      templateVersion: "1.0.0",
    },
    { chain, contract, operation: "mint", quantity: 2n, sender },
    { amount, chain, operation: "transfer", recipient, sender },
  ];

  it.each(intents)("accepts a valid $operation intent", (intent) => {
    expect(transactionIntentSchema.safeParse(intent).success).toBe(true);
  });

  it("carries a family extension as typed JSON", () => {
    const withExtension = {
      ...intents[1],
      extension: { gasLimit: 21000, tags: ["a"] },
    };
    expect(transactionIntentSchema.safeParse(withExtension).success).toBe(true);
    const invalid = { ...intents[1], extension: { gasLimit: Number.NaN } };
    expect(transactionIntentSchema.safeParse(invalid).success).toBe(false);
  });

  it.each([
    ["sender", { sender: { chain: other, value: "0xsender" } }],
    ["mint contract", { contract: { ...contract, chain: other } }],
  ])("refuses a mint whose %s belongs to another chain", (_name, change) => {
    expect(
      transactionIntentSchema.safeParse({ ...intents[1], ...change }).success,
    ).toBe(false);
  });

  it.each([
    ["recipient", { recipient: { chain: other, value: "0xrecipient" } }],
    [
      "amount",
      { amount: { asset: { ...asset, chain: other }, baseUnits: 5n } },
    ],
  ])(
    "refuses a transfer whose %s belongs to another chain",
    (_name, change) => {
      expect(
        transactionIntentSchema.safeParse({ ...intents[2], ...change }).success,
      ).toBe(false);
    },
  );

  it("refuses unknown operations, zero quantity, bad versions, and stray fields", () => {
    expect(
      transactionIntentSchema.safeParse({ ...intents[0], operation: "burn" })
        .success,
    ).toBe(false);
    expect(
      transactionIntentSchema.safeParse({ ...intents[1], quantity: 0n })
        .success,
    ).toBe(false);
    expect(
      transactionIntentSchema.safeParse({
        ...intents[0],
        templateVersion: "1.0",
      }).success,
    ).toBe(false);
    expect(
      transactionIntentSchema.safeParse({ ...intents[1], gas: 1 }).success,
    ).toBe(false);
  });
});

describe("transaction summary and payloads", () => {
  const unsigned = {
    chain,
    family: "evm",
    format: "raw",
    payload: "AAEC",
    summary,
  };

  it("accepts a complete summary and requires a fee and an expiry", () => {
    expect(transactionSummarySchema.safeParse(summary).success).toBe(true);
    const withoutFee = without(summary, "fee");
    expect(transactionSummarySchema.safeParse(withoutFee).success).toBe(false);
    expect(
      transactionSummarySchema.safeParse({ ...summary, expiresAt: "tomorrow" })
        .success,
    ).toBe(false);
  });

  it("accepts a summary with no recipient, amount, or asset, as a deploy or mint shows", () => {
    const bare = {
      chain,
      expiresAt: summary.expiresAt,
      fee: summary.fee,
      operation: "mint",
    };
    expect(transactionSummarySchema.safeParse(bare).success).toBe(true);
  });

  it.each([
    ["fee", { fee: { asset: { ...asset, chain: other }, baseUnits: 1n } }],
    ["recipient", { recipient: { chain: other, value: "0xrecipient" } }],
    ["asset", { asset: { ...asset, chain: other } }],
    [
      "amount",
      { amount: { asset: { ...asset, chain: other }, baseUnits: 5n } },
    ],
  ])("refuses a summary whose %s belongs to another chain", (_name, change) => {
    expect(
      transactionSummarySchema.safeParse({ ...summary, ...change }).success,
    ).toBe(false);
  });

  it("refuses an unsigned transaction whose summary describes another chain", () => {
    expect(unsignedTransactionSchema.safeParse(unsigned).success).toBe(true);
    const mismatched = { ...unsigned, chain: other };
    expect(unsignedTransactionSchema.safeParse(mismatched).success).toBe(false);
    expect(
      unsignedTransactionSchema.safeParse({ ...unsigned, payload: "" }).success,
    ).toBe(false);
  });

  it("accepts a signed transaction with the same opaque payload fields", () => {
    const fields = without(unsigned, "summary");
    expect(signedTransactionSchema.safeParse(fields).success).toBe(true);
    expect(signedTransactionSchema.safeParse(unsigned).success).toBe(false);
  });
});

describe("broadcast outcomes and observations", () => {
  const ref = { chain, id: "0xtx" };

  it("requires a transaction id wherever the network may have seen the transaction", () => {
    expect(
      broadcastOutcomeSchema.safeParse({ kind: "accepted", ref }).success,
    ).toBe(true);
    expect(
      broadcastOutcomeSchema.safeParse({ kind: "ambiguous", ref }).success,
    ).toBe(true);
    expect(broadcastOutcomeSchema.safeParse({ kind: "accepted" }).success).toBe(
      false,
    );
    expect(
      broadcastOutcomeSchema.safeParse({ kind: "ambiguous" }).success,
    ).toBe(false);
    expect(
      broadcastOutcomeSchema.safeParse({ kind: "unavailable" }).success,
    ).toBe(true);
    expect(
      broadcastOutcomeSchema.safeParse({ kind: "rejected", reason: "" })
        .success,
    ).toBe(false);
  });

  it("records provider, time, and block evidence", () => {
    const observation = {
      block: { chain, hash: "0xblock", height: 10 },
      confirmations: 1,
      observedAt: "2026-10-09T12:00:00.000Z",
      provider: "primary",
      ref,
      status: "confirmed",
    };
    expect(observationSchema.safeParse(observation).success).toBe(true);
    expect(
      observationSchema.safeParse({ ...observation, confirmations: -1 })
        .success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({ ...observation, provider: "" }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({ ...observation, status: "mempool" })
        .success,
    ).toBe(false);
  });
});
