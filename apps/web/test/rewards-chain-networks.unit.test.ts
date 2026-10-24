import { chainRefSchema, walletNetworks } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it, vi } from "vitest";

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
import { rewardsPolicy } from "../../../configs/rewards-policy.ts";
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

  it("holds testnet4 to the very policy signet is held to: one record, no value of its own", () => {
    // ADR-019, point 7: the policy (`rewardsPolicy`) is not keyed by network, so every beta network reads the same confirmations,
    // gate, fee speeds and delay. This fails if a network ever gets a record that differs without the decision being taken.
    const reference = chainConfig(betaChains.signet);
    for (const beta of Object.values(betaChains)) {
      const config = chainConfig(beta);
      expect(config.confirmations).toEqual(reference.confirmations);
      expect(config.releaseGate).toBe(reference.releaseGate);
    }
    expect(Object.keys(rewardsPolicy)).not.toContain("signet");
    expect(Object.keys(rewardsPolicy)).not.toContain("testnet4");
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

describe("BETA_NETWORK", () => {
  const followed = async (value: string | undefined) => {
    vi.resetModules();
    if (value === undefined) vi.unstubAllEnvs();
    else vi.stubEnv("BETA_NETWORK", value);
    try {
      const chains = await import("../../../configs/chains.ts");
      const wallet = await import("../../../configs/wallet.ts");
      const plan = await import("../../../configs/rewards-plan.ts");
      return { chains, plan, wallet };
    } finally {
      vi.unstubAllEnvs();
    }
  };

  it("chooses the chain, the wallet network, the target chains and the rewards plan, signet while blank", async () => {
    const blank = await followed(undefined);
    expect(blank.chains.betaNetwork).toBe("signet");
    for (const [value, network, id] of [
      ["", "signet", bitcoinSignetChainId],
      ["signet", "signet", bitcoinSignetChainId],
      ["testnet4", "testnet4", bitcoinTestnet4ChainId],
    ] as const) {
      const set = await followed(value);
      expect(set.chains.betaNetwork).toBe(network);
      expect(set.chains.betaChain.chain.chainId).toBe(id);
      expect(set.chains.targetChains.map(({ chainId }) => chainId)).toEqual([
        id,
      ]);
      expect(set.wallet.walletAuthConfig.network).toBe(network);
      expect(set.plan.rewardsPlan.chain).toBe(id);
    }
  });

  it("stops boot on a network the platform has no chain for", async () => {
    await expect(followed("testnet3")).rejects.toThrow("BETA_NETWORK");
  });
});

describe("which addresses the followed chain accepts", () => {
  const testAddress = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
  const mainnetAddress = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";

  it.each(Object.values(betaChains))(
    "takes only the notation of $network",
    ({ network }) => {
      const followed = createRewardsChain(
        environment,
        platform,
        betaChains[network],
      )?.followed;
      expect(followed?.accepts(testAddress)).toBe(true);
      expect(followed?.accepts(mainnetAddress)).toBe(false);
      expect(followed?.accepts("not-an-address")).toBe(false);
      expect(followed?.accepts("")).toBe(false);
    },
  );
});
