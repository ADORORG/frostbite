import { describe, expect, it } from "vitest";

import { validateBitcoinAddress } from "../src/bitcoin/address.ts";

const mainnetP2wpkh = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const mainnetP2tr =
  "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";
const signetP2wpkh = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
// An address Bitcoin Core's regtest wallet made, and a legacy testnet one (regtest, signet and testnet4 share testnet's version bytes).
// Signet and testnet4 write addresses alike (`tb`), so the same address is valid on both: the chain a request names says which.
const regtestP2wpkh = "bcrt1qn42y974s76dhr4jsswtqer8sl2h8aracmelqvs";
const testnetLegacy = "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn";

describe("validateBitcoinAddress", () => {
  it.each([
    [mainnetP2wpkh, "mainnet", "p2wpkh", 44],
    [mainnetP2tr, "mainnet", "p2tr", 68],
    [signetP2wpkh, "signet", "p2wpkh", 44],
    [signetP2wpkh, "testnet4", "p2wpkh", 44],
    [regtestP2wpkh, "regtest", "p2wpkh", 44],
  ] as const)("validates %s", (candidate, network, type, scriptLength) => {
    const result = validateBitcoinAddress(candidate, network);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ address: candidate, network, type });
      expect(result.value.scriptHex).toHaveLength(scriptLength);
    }
  });

  it.each([
    ["", "mainnet", "invalid-address"],
    [regtestP2wpkh, "signet", "invalid-address"],
    [regtestP2wpkh, "mainnet", "invalid-address"],
    [signetP2wpkh, "regtest", "invalid-address"],
    [testnetLegacy, "regtest", "unsupported-address-type"],
    [testnetLegacy, "mainnet", "invalid-address"],
    [mainnetP2wpkh, "signet", "invalid-address"],
    [mainnetP2wpkh, "testnet4", "invalid-address"],
    [regtestP2wpkh, "testnet4", "invalid-address"],
    [testnetLegacy, "testnet4", "unsupported-address-type"],
    [signetP2wpkh, "mainnet", "invalid-address"],
    [` ${mainnetP2wpkh}`, "mainnet", "invalid-address"],
    [mainnetP2wpkh.toUpperCase(), "mainnet", "invalid-address"],
    [`${mainnetP2wpkh.slice(0, -1)}x`, "mainnet", "invalid-address"],
    [
      "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      "mainnet",
      "unsupported-address-type",
    ],
    ["1BoatSLRHtKNngkdXEeobR76b53LETtpyT", "signet", "invalid-address"],
    [
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "mainnet",
      "unsupported-address-type",
    ],
    [
      "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
      "mainnet",
      "unsupported-address-type",
    ],
    [
      "bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs",
      "mainnet",
      "unsupported-address-type",
    ],
  ] as const)("rejects %s", (candidate, network, code) => {
    expect(validateBitcoinAddress(candidate, network)).toEqual({
      code,
      ok: false,
    });
  });
});
