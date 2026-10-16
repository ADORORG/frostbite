import { chainRefSchema } from "@ador/shared/chain";

import { createBitcoinAlkanesAdapter } from "@ador/chain/bitcoin-alkanes";

import { defineChainAdapterConformance } from "../src/chain-conformance.ts";
import { simulated } from "./support/chains.ts";

defineChainAdapterConformance("simulated", () => {
  const { adapter, fixtures, rewards } = simulated();
  return { adapter, fixtures, rewards };
});

// The same adapter held to the same suite with a claim as the transaction it builds, signs and broadcasts.
defineChainAdapterConformance("simulated (mint-milestone)", () => {
  const { adapter, claimFixtures, rewards } = simulated();
  return { adapter, fixtures: claimFixtures, rewards };
});

// Invented references: which CAIP-2 id is which network is configuration, not code.
const main = chainRefSchema.parse("bip122:00000000000000000000000000000001");
const test = chainRefSchema.parse("bip122:00000000000000000000000000000002");
const unserved = chainRefSchema.parse(
  "bip122:00000000000000000000000000000003",
);

defineChainAdapterConformance("bitcoin-alkanes", () => ({
  adapter: createBitcoinAlkanesAdapter(
    new Map([
      [main, "mainnet"],
      [test, "signet"],
    ] as const),
  ),
  fixtures: {
    address: {
      canonical: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      invalid: [
        "",
        " bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4",
        "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      ],
    },
    chain: main,
    crossChain: ["tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"],
    unservedChain: unserved,
  },
}));
