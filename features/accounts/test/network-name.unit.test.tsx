import { walletNetworks } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { networkName, shortAddress } from "../src/widget/format.ts";

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

describe("an address for a place with little room", () => {
  it("keeps the start and the end, and the middle only as an ellipsis", () => {
    expect(shortAddress("tb1qrxv4phfqavpxjnj37p2k9rd68fxe89q94kpj76")).toBe(
      "tb1qrx…pj76",
    );
  });

  it("leaves a short one whole, up to twelve characters, and shortens from the next", () => {
    expect(shortAddress("tb1qabc")).toBe("tb1qabc");
    expect(shortAddress("123456789012")).toBe("123456789012");
    expect(shortAddress("1234567890123")).toBe("123456…0123");
  });
});
