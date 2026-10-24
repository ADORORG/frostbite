import { chainRefSchema } from "@ador/shared/chain";
import type { RewardsChainEnvironment } from "@repo/config/rewards-chain";
import { describe, expect, it } from "vitest";

import { betaChains } from "../../../configs/chains.ts";
import {
  createRewardsChain,
  type RewardsPlatform,
} from "../../../configs/rewards-chain.ts";

const environment: RewardsChainEnvironment = {
  maxFeeSats: 25_000n,
  rpcHeaders: {},
  rpcTimeoutMs: 400,
  rpcUrl: "https://node.example.invalid/v1/rpc",
  templatesDirectory: null,
};

// A node whose own fee estimates are the absurd ones the hosted gateways gave, and an explorer that recommends sensible ones.
function world() {
  const explorerAsked: string[] = [];
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
    get: async (address) => {
      explorerAsked.push(address);
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
  return { explorerAsked, nodeAsked, platform };
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
});
