import { chainRefSchema } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it } from "vitest";

import { betaChains } from "@repo/configs/chains";
import {
  createRewardsChain,
  type RewardsPlatform,
} from "@repo/configs/rewards-chain";

const environment: RewardsChainEnvironment = {
  feeSource: { adapter: "mempool", fallbackSatPerVb: null },
  maxFeeSats: 25_000n,
  rpcHeaders: {},
  rpcTimeoutMs: 400,
  rpcUrl: "https://node.example.invalid/v1/rpc",
  templatesDirectory: null,
};

// A node whose own fee estimates are the absurd ones the hosted gateways gave, and an explorer that recommends sensible ones.
function world() {
  const explorerAsked: string[] = [];
  const explorerSignals: AbortSignal[] = [];
  const nodeAsked: string[] = [];
  const platform: RewardsPlatform = {
    fetch: async (_address, init) => {
      const call = JSON.parse(init.body) as { id: number; method: string };
      nodeAsked.push(call.method);
      return {
        json: () =>
          Promise.resolve({
            id: call.id,
            jsonrpc: "2.0",
            result: { "1": 588235.294, "25": 272.159 },
          }),
        ok: true,
        status: 200,
      };
    },
    get: async (address, init) => {
      explorerAsked.push(address);
      explorerSignals.push(init.signal);
      return {
        json: () =>
          Promise.resolve({
            economyFee: 1,
            fastestFee: 3,
            halfHourFee: 2,
            hourFee: 2,
            minimumFee: 1,
          }),
        ok: true,
        status: 200,
      };
    },
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    random: (length) => new Uint8Array(length),
    readFile: () => Promise.reject(new Error("no disk in this test")),
  };
  return { explorerAsked, explorerSignals, nodeAsked, platform };
}

describe("the fee rates of the beta networks", () => {
  for (const [name, beta] of Object.entries(betaChains)) {
    it(`come from mempool.space's ${name} by default, and the node's own estimates are not asked`, async () => {
      const { explorerAsked, nodeAsked, platform } = world();
      const rewards = createRewardsChain(environment, platform, beta);
      const chain = chainRefSchema.parse(beta.chain.chainId);
      const ports = rewards?.chain(chain)?.ports;
      const rates = await ports?.observer.feeRates(chain, [1, 25]);
      expect(rates?.map(({ satPerVb }) => satPerVb)).toEqual([3, 1]);
      expect(explorerAsked).toEqual([
        `https://mempool.space/${name}/api/v1/fees/recommended`,
      ]);
      expect(nodeAsked).not.toContain("esplora_fee-estimates");
    });
  }

  describe("when the operator chooses Blockstream", () => {
    for (const [name, beta] of Object.entries(betaChains)) {
      it(`${name}: its estimates per target are read at its own address for the network`, async () => {
        const { explorerAsked, explorerSignals, nodeAsked, platform } = world();
        const blockstream: RewardsPlatform = {
          ...platform,
          get: async (address, init) => {
            explorerAsked.push(address);
            explorerSignals.push(init.signal);
            return {
              json: () => Promise.resolve({ "1": 9, "6": 5 }),
              ok: true,
              status: 200,
            };
          },
        };
        const rewards = createRewardsChain(
          {
            ...environment,
            feeSource: { adapter: "blockstream", fallbackSatPerVb: null },
          },
          blockstream,
          beta,
        );
        const chain = chainRefSchema.parse(beta.chain.chainId);
        const rates = await rewards
          ?.chain(chain)
          ?.ports.observer.feeRates(chain, [1, 4]);
        expect(rates?.map(({ satPerVb }) => satPerVb)).toEqual([9, 5]);
        expect(explorerAsked).toEqual([
          `https://blockstream.info/${name}/api/fee-estimates`,
        ]);
        expect(nodeAsked).not.toContain("esplora_fee-estimates");
        // The explorer is given the deployment's time limit (400 ms here), not a shorter one.
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(explorerSignals.map(({ aborted }) => aborted)).toEqual([false]);
      });
    }
  });

  describe("when the operator sets a fallback rate", () => {
    const withFallback: RewardsChainEnvironment = {
      ...environment,
      feeSource: { adapter: "mempool", fallbackSatPerVb: 2.5 },
    };
    for (const [name, beta] of Object.entries(betaChains)) {
      it(`${name}: is used for every confirmation target when the explorer cannot be read, and the operator is told`, async () => {
        const { nodeAsked, platform } = world();
        const told: string[] = [];
        const rewards = createRewardsChain(
          withFallback,
          {
            ...platform,
            get: () => Promise.reject(new Error("offline")),
            warn: (message) => told.push(message),
          },
          beta,
        );
        const chain = chainRefSchema.parse(beta.chain.chainId);
        const rates = await rewards
          ?.chain(chain)
          ?.ports.observer.feeRates(chain, [1, 3, 25]);
        expect(rates).toEqual([
          { satPerVb: 2.5, targetBlocks: 1 },
          { satPerVb: 2.5, targetBlocks: 3 },
          { satPerVb: 2.5, targetBlocks: 25 },
        ]);
        expect(told).toEqual([
          "The fee source mempool could not be read (The fee source could not be reached.); REWARDS_FEE_RATE_SAT_VB is used.",
        ]);
        expect(nodeAsked).not.toContain("esplora_fee-estimates");
      });

      it(`${name}: is not used while the explorer answers`, async () => {
        const { platform } = world();
        const told: string[] = [];
        const rewards = createRewardsChain(
          withFallback,
          { ...platform, warn: (message) => told.push(message) },
          beta,
        );
        const chain = chainRefSchema.parse(beta.chain.chainId);
        const rates = await rewards
          ?.chain(chain)
          ?.ports.observer.feeRates(chain, [1]);
        expect(rates?.[0]?.satPerVb).toBe(3);
        expect(told).toEqual([]);
      });
    }

    it("works with nobody to tell", async () => {
      const { platform } = world();
      const rewards = createRewardsChain(
        withFallback,
        { ...platform, get: () => Promise.reject(new Error("offline")) },
        betaChains.signet,
      );
      const chain = chainRefSchema.parse(betaChains.signet.chain.chainId);
      expect(
        (await rewards?.chain(chain)?.ports.observer.feeRates(chain, [1]))?.[0]
          ?.satPerVb,
      ).toBe(2.5);
    });
  });
});
