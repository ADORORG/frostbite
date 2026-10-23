import { describe, expect, it } from "vitest";

import {
  bitcoinNetworks,
  isWalletNetwork,
  walletNetworks,
  walletNetworkSchema,
} from "../src/chain/networks.ts";

describe("the Bitcoin network vocabulary", () => {
  it("names testnet4 beside signet, as separate networks", () => {
    expect(bitcoinNetworks).toEqual([
      "mainnet",
      "signet",
      "testnet4",
      "regtest",
    ]);
  });

  it("lets a wallet be on mainnet, signet or testnet4, and never on a developer's regtest", () => {
    expect(walletNetworks).toEqual(["mainnet", "signet", "testnet4"]);
    for (const network of walletNetworks) {
      expect(walletNetworkSchema.parse(network)).toBe(network);
      expect(isWalletNetwork(network)).toBe(true);
    }
    for (const other of ["regtest", "testnet", "Signet", "", "testnet4 "]) {
      expect(walletNetworkSchema.safeParse(other).success).toBe(false);
      expect(isWalletNetwork(other)).toBe(false);
    }
  });
});
