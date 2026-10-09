import { chainRefSchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { createBitcoinAlkanesAdapter } from "../src/bitcoin-alkanes/adapter.ts";
import { createChainRegistry } from "../src/registry.ts";
import { InvalidAddressError } from "../src/ports.ts";
import { chainConfig } from "./support/chains.ts";

// Invented references: which CAIP-2 id is which network is configuration, not code.
const main = chainRefSchema.parse("bip122:00000000000000000000000000000001");
const test = chainRefSchema.parse("bip122:00000000000000000000000000000002");
const mainnetAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
const signetAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const legacyAddress = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";

function adapter() {
  return createBitcoinAlkanesAdapter(
    new Map([
      [main, "mainnet"],
      [test, "signet"],
    ] as const),
  );
}

function codec() {
  const found = adapter().ports.addressCodec;
  if (!found) throw new Error("the adapter must provide an address codec");
  return found;
}

describe("bitcoin-alkanes adapter", () => {
  it("returns the canonical address attached to its chain", () => {
    expect(codec().parse(main, mainnetAddress)).toEqual({
      chain: main,
      value: mainnetAddress,
    });
    expect(codec().parse(test, signetAddress)).toEqual({
      chain: test,
      value: signetAddress,
    });
  });

  it.each([
    ["an address of the other network", main, signetAddress],
    ["the other network's address on a signet chain", test, mainnetAddress],
    [
      "a non-canonical (upper-case) address",
      main,
      mainnetAddress.toUpperCase(),
    ],
    ["an address with surrounding whitespace", main, ` ${mainnetAddress}`],
    ["a legacy address of an unsupported type", main, legacyAddress],
    ["an empty string", main, ""],
  ])("rejects %s", (_name, chain, text) => {
    expect(() => codec().parse(chain, text)).toThrow(InvalidAddressError);
  });

  it("rejects a valid address on a chain the adapter does not serve", () => {
    const unserved = chainRefSchema.parse(
      "bip122:00000000000000000000000000000003",
    );
    expect(() => codec().parse(unserved, mainnetAddress)).toThrow(
      /not served by this adapter/u,
    );
    expect(adapter().supports(unserved)).toBe(false);
    expect(adapter().supports(main)).toBe(true);
  });

  it("declares only the capability it provides", () => {
    expect([...adapter().capabilities]).toEqual(["address:codec"]);
    expect(Object.keys(adapter().ports)).toEqual(["addressCodec"]);
    expect(adapter().testOnly).toBe(false);
  });

  it("refuses a chain from another namespace and an empty chain list", () => {
    expect(() =>
      createBitcoinAlkanesAdapter(
        new Map([[chainRefSchema.parse("eip155:1"), "mainnet"]] as const),
      ),
    ).toThrow(/not a bip122 chain/u);
    expect(() => createBitcoinAlkanesAdapter(new Map())).toThrow(
      /at least one chain/u,
    );
  });

  it("registers cleanly, and a feature needing more than it offers fails at boot", () => {
    const chains = [
      chainConfig({
        chainId: test,
        family: adapter().family,
        role: "public-beta",
      }),
    ];
    const registry = createChainRegistry({ adapters: [adapter()], chains });
    expect(
      registry.port(test, "addressCodec").parse(test, signetAddress).value,
    ).toBe(signetAddress);
    expect(() =>
      createChainRegistry({
        adapters: [adapter()],
        chains,
        requiredCapabilities: ["transaction:broadcast"],
      }),
    ).toThrow(/lacks required capability transaction:broadcast/u);
  });
});
