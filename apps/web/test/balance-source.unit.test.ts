import { describe, expect, it, vi } from "vitest";

import { betaChain } from "../../../configs/chains.ts";

const testAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
// What the chain accepts as an address is the chain's word (see the rewards chain tests); here it accepts only the test address.
const chainAccepting = (
  balance: () => Promise<unknown> = async () => null,
) => ({
  accepts: (address: string) => address === testAddress,
  balance,
});

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

  it("reads only an address the chain accepts, for the network the deployment runs on", async () => {
    const source = await sourceWith(chainAccepting());
    expect(source?.accepts(testAddress, betaChain.network)).toBe(true);
    // A wallet on another network is not looked up, whatever its address.
    expect(source?.accepts(testAddress, "mainnet")).toBe(false);
    // Signet and testnet4 write addresses alike, so only the network the wallet is on tells them apart.
    const otherTestNetwork =
      betaChain.network === "signet" ? "testnet4" : "signet";
    expect(source?.accepts(testAddress, otherTestNetwork)).toBe(false);
    expect(source?.accepts("not-an-address", betaChain.network)).toBe(false);
  });

  it("gives what the chain says is spendable and what is still waiting, as numbers", async () => {
    const balance = vi.fn(async () => ({
      confirmed: 123_456n,
      pending: 5_000_000n,
    }));
    const source = await sourceWith({ ...chainAccepting(), balance });
    expect(await source?.balance(testAddress, betaChain.network)).toEqual({
      confirmedSats: 123_456,
      pendingSats: 5_000_000,
    });
    expect(balance).toHaveBeenCalledWith(testAddress);
  });
});
