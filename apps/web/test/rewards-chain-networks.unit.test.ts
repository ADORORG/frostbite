import { chainRefSchema, walletNetworks } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it } from "vitest";

import {
  betaChain,
  betaChains,
  bitcoinSignetChainId,
  bitcoinTestnet4ChainId,
  targetChains,
} from "../../../configs/chains.ts";
import {
  chainConfig,
  createRewardsChain,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";
import { rewardsPlan } from "../../../configs/rewards-plan.ts";
import { walletAuthConfig } from "../../../configs/wallet.ts";

const environment: RewardsChainEnvironment = {
  maxFeeSats: 25_000n,
  rpcHeaders: {},
  rpcTimeoutMs: 400,
  rpcUrl: "https://node.example.invalid/v1/rpc",
  templatesDirectory: null,
};
const platform: RewardsPlatform = {
  fetch: () => Promise.reject(new Error("offline")),
  now: () => new Date("2026-01-01T00:00:00.000Z"),
  random: (length) => new Uint8Array(length),
  readFile: () => Promise.reject(new Error("no disk in this test")),
};

describe("the beta's test networks", () => {
  it("are signet and testnet4, each its own chain with the wallet network it needs", () => {
    expect(betaChains.signet.chain.chainId).toBe(bitcoinSignetChainId);
    expect(betaChains.signet.network).toBe("signet");
    expect(betaChains.testnet4.chain.chainId).toBe(bitcoinTestnet4ChainId);
    expect(betaChains.testnet4.network).toBe("testnet4");
    expect(bitcoinTestnet4ChainId).not.toBe(bitcoinSignetChainId);
    for (const { chain, network } of Object.values(betaChains)) {
      expect(walletNetworks).toContain(network);
      expect(chainRefSchema.safeParse(chain.chainId).success).toBe(true);
    }
  });

  it("write testnet4's chain from its genesis block, BIP-122 style: the first sixteen bytes of 00000000da84f2ba…", () => {
    expect(bitcoinTestnet4ChainId).toBe(
      "bip122:00000000da84f2bafbbc53dee25a72ae",
    );
  });

  it("are followed everywhere by the one chain the deployment chose", () => {
    expect(targetChains).toEqual([betaChain.chain]);
    expect(rewardsPlan.chain).toBe(betaChain.chain.chainId);
    expect(walletAuthConfig.network).toBe(betaChain.network);
  });
});

describe("the rewards chain on testnet4", () => {
  const testnet4 = chainRefSchema.parse(bitcoinTestnet4ChainId);
  const signet = chainRefSchema.parse(bitcoinSignetChainId);

  it("is the chain's own record, under the same decided confirmations", () => {
    const config = chainConfig(betaChains.testnet4);
    expect(config).toMatchObject({
      chainId: testnet4,
      displayName: "Bitcoin testnet4",
      family: "bitcoin-alkanes",
      releaseGate: "open",
    });
    expect(chainConfig(betaChains.signet).chainId).toBe(signet);
    for (const finality of Object.values(config.confirmations)) {
      expect(finality).toEqual({ kind: "confirmations", required: 1 });
    }
  });

  it("offers testnet4 and not signet, and names it as the chain whose indexer it follows", () => {
    const rewards = createRewardsChain(
      environment,
      platform,
      betaChains.testnet4,
    );
    expect(rewards?.chain(testnet4)).not.toBeNull();
    expect(rewards?.chain(signet)).toBeNull();
    expect(rewards?.followed.displayName).toBe("Bitcoin testnet4");
  });
});
