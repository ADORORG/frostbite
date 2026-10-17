import { describe, expect, it } from "vitest";

import { chainRefSchema } from "../src/chain/chain-ref.ts";
import { readTracked, trackedValues } from "../src/chain/tracked-row.ts";
import { transactionSummarySchema } from "../src/chain/transaction.ts";

const chain = chainRefSchema.parse("simnet:one");
const contract = { chain, family: "simulated", id: "rewards-1" } as never;
const summary = transactionSummarySchema.parse({
  chain,
  expiresAt: "2026-10-16T12:10:00.000Z",
  fee: { asset: { chain, id: "sim", kind: "native" }, baseUnits: 1n },
  operation: "set-claims-paused",
  paused: true,
  contract,
});
const unsigned = {
  chain,
  family: "simulated" as never,
  format: "f",
  payload: "p",
  summary,
};

describe("a tracked transaction as a row", () => {
  it("is written as columns and read back as the same checked transaction", () => {
    const values = trackedValues({ chain, contract, unsigned });
    expect(values).toMatchObject({
      chain,
      contractId: "rewards-1",
      unsignedPayload: "p",
    });
    const read = readTracked({
      ...values,
      expiresAt: new Date(),
      failureReason: null,
      signedPayload: null,
      state: "awaiting_signature",
      transactionId: null,
    });
    expect(read).toMatchObject({ chain, state: "awaiting_signature" });
    expect(read.contract).toEqual(contract);
    expect(read.unsigned).toEqual(unsigned);
  });

  it("refuses a row whose chain, family or summary is not valid", () => {
    const values = trackedValues({ chain, contract, unsigned });
    const row = {
      ...values,
      expiresAt: new Date(),
      failureReason: null,
      signedPayload: null,
      state: "awaiting_signature",
      transactionId: null,
    };
    expect(() => readTracked({ ...row, chain: "nope" })).toThrow();
    expect(() =>
      readTracked({ ...row, summary: { operation: "x" } }),
    ).toThrow();
  });

  it("keeps a step that acts on no contract yet without one, and refuses half a contract", () => {
    const values = trackedValues({ chain, contract: null, unsigned });
    expect(values).toMatchObject({ contractFamily: null, contractId: null });
    const row = {
      ...values,
      expiresAt: new Date(),
      failureReason: null,
      signedPayload: null,
      state: "awaiting_signature",
      transactionId: null,
    };
    expect(readTracked(row).contract).toBeNull();
    expect(() => readTracked({ ...row, contractFamily: "simulated" })).toThrow(
      /family and id/u,
    );
    expect(() => readTracked({ ...row, contractId: "x" })).toThrow(
      /family and id/u,
    );
  });
});
