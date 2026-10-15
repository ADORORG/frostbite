import { describe, expect, it, vi } from "vitest";

import { createBalanceOperation } from "../src/application/balance-operation.ts";
import {
  maxSatoshis,
  walletBalanceResponseSchema,
} from "../src/balance/contract.ts";
import { address, anonymous } from "./support/wallet-operations.ts";

const now = new Date("2026-10-15T12:00:00.000Z");
const clock = () => now;
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

  it("asks the source for the canonical address on the named network and answers with the time it was asked", async () => {
    const satoshis = vi.fn(async () => 123_456);
    const result = await ask({ satoshis });
    expect(satoshis).toHaveBeenCalledWith(address, "signet");
    expect(result).toEqual({
      ok: true,
      value: {
        asOf: "2026-10-15T12:00:00.000Z",
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
    expect(await ask({ satoshis: async () => 0 })).toMatchObject({
      ok: true,
      value: { satoshis: 0, status: "ready" },
    });
  });

  it("refuses an address that is not valid for the network, without asking the source", async () => {
    const satoshis = vi.fn(async () => 1);
    for (const input of [
      { address: "tb1qnotanaddressatall0000000", network: "signet" as const },
      // A signet address is not a mainnet address.
      { address, network: "mainnet" as const },
    ])
      expect(await ask({ satoshis }, input)).toMatchObject({
        error: "invalid_request",
        ok: false,
      });
    expect(satoshis).not.toHaveBeenCalled();
  });

  it.each([
    ["a failing source", () => Promise.reject(new Error("indexer down"))],
    ["a negative balance", async () => -1],
    ["a fraction", async () => 1.5],
    ["not a number", async () => Number.NaN],
    ["more than can exist", async () => maxSatoshis + 1],
  ])(
    "says the source failed for %s, never showing a number",
    async (_name, satoshis) => {
      expect(await ask({ satoshis })).toEqual({
        ok: true,
        value: { reason: "source-failed", status: "unavailable" },
      });
    },
  );

  it("accepts the largest balance that can exist", async () => {
    expect(await ask({ satoshis: async () => maxSatoshis })).toMatchObject({
      value: { satoshis: maxSatoshis, status: "ready" },
    });
  });
});
