import { chainRefSchema } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it } from "vitest";

import { betaChains } from "../../../configs/chains.ts";
import {
  createRewardsChain,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";

const environment: RewardsChainEnvironment = {
  feeSource: { kind: "default" },
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
  it("name a public explorer for each network, up to the network", () => {
    expect(betaChains.signet.feeApiUrl).toBe("https://mempool.space/signet");
    expect(betaChains.testnet4.feeApiUrl).toBe(
      "https://mempool.space/testnet4",
    );
  });

  for (const [name, beta] of Object.entries(betaChains)) {
    it(`come from ${name}'s explorer, and the node's own estimates are not asked`, async () => {
      const { explorerAsked, nodeAsked, platform } = world();
      const rewards = createRewardsChain(environment, platform, beta);
      const chain = chainRefSchema.parse(beta.chain.chainId);
      const ports = rewards?.chain(chain)?.ports;
      const rates = await ports?.observer.feeRates(chain, [1, 25]);
      expect(rates?.map(({ satPerVb }) => satPerVb)).toEqual([3, 1]);
      expect(explorerAsked).toEqual([
        `${beta.feeApiUrl}/api/v1/fees/recommended`,
      ]);
      expect(nodeAsked).not.toContain("esplora_fee-estimates");
    });
  }

  describe("when the operator names another explorer", () => {
    for (const [name, beta] of Object.entries(betaChains)) {
      it(`${name}: are asked of that explorer and not the network's own`, async () => {
        const { explorerAsked, explorerSignals, nodeAsked, platform } = world();
        const rewards = createRewardsChain(
          {
            ...environment,
            feeSource: {
              format: "mempool",
              kind: "explorer",
              url: "https://fees.example.invalid/mirror",
            },
          },
          platform,
          beta,
        );
        const chain = chainRefSchema.parse(beta.chain.chainId);
        const rates = await rewards
          ?.chain(chain)
          ?.ports.observer.feeRates(chain, [1]);
        expect(rates?.map(({ satPerVb }) => satPerVb)).toEqual([3]);
        expect(explorerAsked).toEqual([
          "https://fees.example.invalid/mirror/api/v1/fees/recommended",
        ]);
        expect(nodeAsked).not.toContain("esplora_fee-estimates");
        // The explorer is given the deployment's time limit (400 ms here), not a shorter one.
        await new Promise((resolve) => setTimeout(resolve, 40));
        expect(explorerSignals.map(({ aborted }) => aborted)).toEqual([false]);
      });
    }
  });

  describe("when the operator names an Esplora-format explorer", () => {
    for (const [name, beta] of Object.entries(betaChains)) {
      it(`${name}: its estimates per target are read at its fee-estimates address`, async () => {
        const { explorerAsked, platform } = world();
        const esplora: RewardsPlatform = {
          ...platform,
          get: async (address, init) => {
            explorerAsked.push(address);
            return {
              json: () => Promise.resolve({ "1": 9, "6": 5 }),
              ok: true,
              status: init.signal.aborted ? 500 : 200,
            };
          },
        };
        const rewards = createRewardsChain(
          {
            ...environment,
            feeSource: {
              format: "esplora",
              kind: "explorer",
              url: "https://fees.example.invalid/esplora",
            },
          },
          esplora,
          beta,
        );
        const chain = chainRefSchema.parse(beta.chain.chainId);
        const rates = await rewards
          ?.chain(chain)
          ?.ports.observer.feeRates(chain, [1, 4]);
        expect(rates?.map(({ satPerVb }) => satPerVb)).toEqual([9, 5]);
        expect(explorerAsked).toEqual([
          "https://fees.example.invalid/esplora/api/fee-estimates",
        ]);
      });
    }
  });

  describe("when the operator sets a fixed rate", () => {
    for (const [name, beta] of Object.entries(betaChains)) {
      it(`${name}: is used for every confirmation target, and nobody is asked`, async () => {
        const { explorerAsked, nodeAsked, platform } = world();
        const rewards = createRewardsChain(
          { ...environment, feeSource: { kind: "fixed", satPerVb: 2.5 } },
          platform,
          beta,
        );
        const chain = chainRefSchema.parse(beta.chain.chainId);
        const rates = await rewards
          ?.chain(chain)
          ?.ports.observer.feeRates(chain, [1, 3, 25]);
        expect(rates?.map(({ satPerVb }) => satPerVb)).toEqual([2.5, 2.5, 2.5]);
        expect(rates?.map(({ targetBlocks }) => targetBlocks)).toEqual([
          1, 3, 25,
        ]);
        expect(explorerAsked).toEqual([]);
        expect(nodeAsked).not.toContain("esplora_fee-estimates");
      });
    }
  });
});
