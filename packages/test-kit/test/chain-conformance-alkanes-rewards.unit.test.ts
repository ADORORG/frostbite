import { chainFamilyIdSchema, chainRefSchema } from "@ador/shared/chain";

import { createBitcoinAlkanesAdapter } from "@ador/chain/bitcoin-alkanes";

import { defineChainAdapterConformance } from "../src/chain-conformance.ts";

const main = chainRefSchema.parse("bip122:00000000000000000000000000000001");
const family = chainFamilyIdSchema.parse("bitcoin-alkanes");
const wallet = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

// A node on which nothing has been claimed and no collectible exists: every count is sixteen zero bytes and a collectible's
// content type is a revert, which is how the indexer answers for an id with no contract.
const emptyNode = {
  bytecode: () => Promise.resolve(null),
  height: () => Promise.resolve(1),
  view: (_target: unknown, opcode: bigint) =>
    Promise.resolve(
      opcode === 100n
        ? { data: new Uint8Array(16), fuelUsed: 0n, ok: true as const }
        : { error: "unexpected end-of-file", ok: false as const },
    ),
};

// The same suite the simulated family passes, with the real adapter's rewards reader on a node that has seen no claims.
defineChainAdapterConformance("bitcoin-alkanes (rewards reader)", () => ({
  adapter: createBitcoinAlkanesAdapter(new Map([[main, "mainnet"]] as const), {
    maxPreviewBytes: 8192,
    nodes: new Map([[main, emptyNode]]),
  }),
  fixtures: {
    address: { canonical: wallet, invalid: ["", " " + wallet] },
    chain: main,
    crossChain: ["tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"],
    unservedChain: chainRefSchema.parse(
      "bip122:00000000000000000000000000000003",
    ),
  },
  rewards: {
    contract: { chain: main, family, id: "2:5" },
    holder: { chain: main, value: wallet },
    milestoneId: "first-frost",
    missingItem: { chain: main, family, id: "2:9" },
  },
}));
