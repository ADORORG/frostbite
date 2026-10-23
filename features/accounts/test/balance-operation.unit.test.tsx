import { describe, expect, it, vi } from "vitest";

import { createBalanceOperation } from "../src/application/balance-operation.ts";
import {
  maxSatoshis,
  walletBalanceResponseSchema,
} from "../src/balance/contract.ts";
import { address, anonymous } from "./support/wallet-operations.ts";

const now = new Date("2026-10-15T12:00:00.000Z");
const clock = () => now;
// A source that accepts every address on signet only, as a real one that reads one network would.
const reads = (
  balance: () => Promise<{ confirmedSats: number; pendingSats: number }>,
) => ({
  accepts: (candidate: string, network: "mainnet" | "signet" | "testnet4") =>
    network === "signet" && candidate.startsWith("tb1q"),
  balance,
});
const confirmed = (confirmedSats: number) => async () => ({
  confirmedSats,
  pendingSats: 0,
});
const ask = (
  source: Parameters<typeof createBalanceOperation>[0]["source"],
  input: { address: string; network: "mainnet" | "signet" } = {
    address,
    network: "signet",
  },
) => createBalanceOperation({ clock, source }).execute(input, anonymous);

describe("the wallet balance", () => {
  it("is open to anyone and takes only an address and a network", () => {
    const operation = createBalanceOperation({ clock, source: null });
    expect(operation.access).toEqual({ kind: "public" });
    expect(
      operation.inputSchema.safeParse({ address, network: "signet" }).success,
    ).toBe(true);
    expect(
      operation.inputSchema.safeParse({ address, network: "signet", extra: 1 })
        .success,
    ).toBe(false);
    expect(
      operation.inputSchema.safeParse({ address: "x", network: "signet" })
        .success,
    ).toBe(false);
  });

  it("says it is not configured, and not zero, when the platform has no data source", async () => {
    expect(await ask(null)).toEqual({
      ok: true,
      value: { reason: "not-configured", status: "unavailable" },
    });
  });

  it("asks the source for the canonical address on the named network and answers with the time it was asked, spendable and pending apart", async () => {
    const balance = vi.fn(async () => ({
      confirmedSats: 123_456,
      pendingSats: 5_000_000,
    }));
    const result = await ask(reads(balance));
    expect(balance).toHaveBeenCalledWith(address, "signet");
    expect(result).toEqual({
      ok: true,
      value: {
        asOf: "2026-10-15T12:00:00.000Z",
        pendingSats: 5_000_000,
        satoshis: 123_456,
        status: "ready",
      },
    });
    if (result.ok)
      expect(walletBalanceResponseSchema.safeParse(result.value).success).toBe(
        true,
      );
  });

  it("answers a real zero as a zero", async () => {
    expect(await ask(reads(confirmed(0)))).toMatchObject({
      ok: true,
      value: { pendingSats: 0, satoshis: 0, status: "ready" },
    });
  });

  it("refuses an address the source does not accept for the network, without looking it up", async () => {
    const balance = vi.fn(confirmed(1));
    for (const input of [
      { address: "bc1pnotforthissource0000000", network: "signet" as const },
      // A signet address is not a mainnet address.
      { address, network: "mainnet" as const },
    ])
      expect(await ask(reads(balance), input)).toMatchObject({
        error: "invalid_request",
        ok: false,
      });
    expect(balance).not.toHaveBeenCalled();
  });

  it.each([
    ["a failing source", () => Promise.reject(new Error("indexer down"))],
    ["a negative balance", confirmed(-1)],
    ["a fraction", confirmed(1.5)],
    ["not a number", confirmed(Number.NaN)],
    ["more than can exist", confirmed(maxSatoshis + 1)],
    [
      "an impossible pending figure",
      async () => ({ confirmedSats: 1, pendingSats: -1 }),
    ],
    [
      "a pending figure that is more than can exist",
      async () => ({ confirmedSats: 1, pendingSats: maxSatoshis + 1 }),
    ],
  ])(
    "says the source failed for %s, never showing a number",
    async (_name, balance) => {
      expect(await ask(reads(balance))).toEqual({
        ok: true,
        value: { reason: "source-failed", status: "unavailable" },
      });
    },
  );

  it("accepts the largest balance that can exist", async () => {
    expect(await ask(reads(confirmed(maxSatoshis)))).toMatchObject({
      value: { satoshis: maxSatoshis, status: "ready" },
    });
  });
});
