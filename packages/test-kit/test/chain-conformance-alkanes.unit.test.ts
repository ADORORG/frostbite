import { chainFamilyIdSchema, chainRefSchema } from "@ador/shared/chain";

import { createBitcoinAlkanesAdapter } from "@ador/chain/bitcoin-alkanes";

import { defineChainAdapterConformance } from "../src/chain-conformance.ts";
import {
  claimNode,
  raiseFirstOutput,
  signAll,
  walletAddress,
} from "./support/alkanes-wallet.ts";

const main = chainRefSchema.parse("bip122:00000000000000000000000000000001");
const family = chainFamilyIdSchema.parse("bitcoin-alkanes");
const game = { chain: main, family, id: "2:5" };
const wallet = { chain: main, value: walletAddress };
const nodes = new Map([[main, claimNode()]]);
const networks = new Map([[main, "mainnet"]] as const);

const addressFixtures = {
  address: { canonical: walletAddress, invalid: ["", ` ${walletAddress}`] },
  chain: main,
  crossChain: ["tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"],
  unservedChain: chainRefSchema.parse(
    "bip122:00000000000000000000000000000003",
  ),
};
const rewards = {
  contract: game,
  holder: wallet,
  milestoneId: "first-frost",
  missingItem: { chain: main, family, id: "2:9" },
};

// The same suite the simulated family passes, with only the real adapter's rewards reader on a node that has seen no claims.
defineChainAdapterConformance("bitcoin-alkanes (rewards reader)", () => ({
  adapter: createBitcoinAlkanesAdapter(networks, {
    maxPreviewBytes: 8192,
    nodes,
  }),
  fixtures: addressFixtures,
  rewards,
}));

// And with a milestone claim built, signed, sent and watched on a node that mines what it is sent.
const now = new Date("2026-10-16T12:00:00.000Z");
defineChainAdapterConformance("bitcoin-alkanes (milestone claim)", () => ({
  adapter: createBitcoinAlkanesAdapter(networks, {
    maxPreviewBytes: 8192,
    nodes: new Map([[main, claimNode()]]),
    transactions: {
      changeDustSats: 294n,
      templateSequence: { attempts: 200, first: 1000n },
      claimOutputSats: 546n,
      feeTargetBlocks: 3,
      feeSpeeds: {
        fast: { approxMinutes: 30, targetBlocks: 3 },
        lightning: { approxMinutes: 15, targetBlocks: 1 },
        medium: { approxMinutes: 60, targetBlocks: 6 },
        slow: { approxMinutes: 250, targetBlocks: 25 },
      },
      lifetimeMs: 600_000,
      now: () => now,
      providerId: "test-node",
    },
  }),
  fixtures: {
    ...addressFixtures,
    transaction: {
      funding: {
        maxFee: {
          asset: { chain: main, id: "btc", kind: "native" },
          baseUnits: 10_000n,
        },
      },
      intent: {
        chain: main,
        contract: game,
        milestoneId: "first-frost",
        operation: "mint-milestone",
        sender: wallet,
      },
      now: () => now,
      sign: signAll,
      tamper: raiseFirstOutput,
    },
  },
  rewards,
}));
