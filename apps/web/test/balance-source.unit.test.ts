import { describe, expect, it, vi } from "vitest";

import { betaChain } from "../../../configs/chains.ts";

// A valid address on the test networks (signet and testnet4 write addresses alike), and one that is mainnet's.
const testAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const mainnetAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

async function sourceWith(followed: unknown) {
  vi.resetModules();
  vi.doMock("../../../configs/game-rewards.ts", () => ({
    followedRewardsChain: followed,
    rewardsChain: () => null,
  }));
  try {
    return (await import("../../../configs/balance.ts")).balanceSource;
  } finally {
    vi.doUnmock("../../../configs/game-rewards.ts");
    vi.resetModules();
  }
}

describe("where the header's balance comes from", () => {
  it("is nothing where the platform follows no chain", async () => {
    expect(await sourceWith(null)).toBeNull();
  });

  it("reads only an address valid on the network the deployment runs on", async () => {
    const source = await sourceWith({ balance: async () => null });
    expect(source?.accepts(testAddress, betaChain.network)).toBe(true);
    // A wallet on another network, or an address from another network, is not looked up.
    expect(source?.accepts(testAddress, "mainnet")).toBe(false);
    // Signet and testnet4 write addresses alike, so only the network the wallet is on tells them apart.
    const otherTestNetwork =
      betaChain.network === "signet" ? "testnet4" : "signet";
    expect(source?.accepts(testAddress, otherTestNetwork)).toBe(false);
    expect(source?.accepts(mainnetAddress, betaChain.network)).toBe(false);
    expect(source?.accepts("not-an-address", betaChain.network)).toBe(false);
  });

  it("gives what the chain says is spendable and what is still waiting, as numbers", async () => {
    const balance = vi.fn(async () => ({
      confirmed: 123_456n,
      pending: 5_000_000n,
    }));
    const source = await sourceWith({ balance });
    expect(await source?.balance(testAddress, betaChain.network)).toEqual({
      confirmedSats: 123_456,
      pendingSats: 5_000_000,
    });
    expect(balance).toHaveBeenCalledWith(testAddress);
  });
});
