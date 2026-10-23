import { walletNetworks } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { networkName } from "../src/widget/format.ts";

describe("the network a wallet is on, in words", () => {
  it("has a name for every network a wallet can be on", () => {
    expect(walletNetworks.map(networkName)).toEqual([
      "Mainnet",
      "Signet",
      "Testnet4",
    ]);
  });

  it("shows a network that is not one of ours as the wallet reported it, never as undefined", () => {
    for (const reported of ["testnet", "regtest", "constructor"]) {
      expect(networkName(reported)).toBe(reported);
    }
  });
});
