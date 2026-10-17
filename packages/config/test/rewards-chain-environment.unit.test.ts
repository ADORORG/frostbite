import { describe, expect, it } from "vitest";

import { parseRewardsChainEnvironment } from "../src/env/rewards-chain.ts";

const node = {
  REWARDS_CHAIN_RPC_URL: "https://node.example.invalid/rpc",
  REWARDS_MAX_FEE_SATS: "20000",
};

describe("the rewards chain environment", () => {
  it("is absent, not an error, while no node address is set", () => {
    expect(parseRewardsChainEnvironment({})).toBeNull();
    expect(
      parseRewardsChainEnvironment({
        REWARDS_CHAIN_RPC_URL: "  ",
        REWARDS_MAX_FEE_SATS: "nonsense",
      }),
    ).toBeNull();
  });

  it("reads a node with the safe defaults: the standard timeout and no templates directory", () => {
    expect(parseRewardsChainEnvironment(node)).toEqual({
      maxFeeSats: 20_000n,
      rpcTimeoutMs: 15_000,
      rpcUrl: "https://node.example.invalid/rpc",
      templatesDirectory: null,
    });
  });

  it("reads every setting when all are given", () => {
    expect(
      parseRewardsChainEnvironment({
        ...node,
        REWARDS_CHAIN_RPC_TIMEOUT_MS: "5000",
        REWARDS_TEMPLATES_DIR: " /srv/templates ",
      }),
    ).toEqual({
      maxFeeSats: 20_000n,
      rpcTimeoutMs: 5000,
      rpcUrl: "https://node.example.invalid/rpc",
      templatesDirectory: "/srv/templates",
    });
  });

  it("stops boot when a node is named without a fee ceiling", () => {
    expect(() =>
      parseRewardsChainEnvironment({
        REWARDS_CHAIN_RPC_URL: node.REWARDS_CHAIN_RPC_URL,
      }),
    ).toThrow();
    expect(() =>
      parseRewardsChainEnvironment({ ...node, REWARDS_MAX_FEE_SATS: "0" }),
    ).toThrow();
  });

  it("refuses an address that is not http or https, and a bad timeout", () => {
    for (const bad of [
      { REWARDS_CHAIN_RPC_URL: "ftp://node.example.invalid" },
      { REWARDS_CHAIN_RPC_URL: "not a url" },
      { REWARDS_CHAIN_RPC_TIMEOUT_MS: "0" },
    ]) {
      expect(() => parseRewardsChainEnvironment({ ...node, ...bad })).toThrow();
    }
  });
});
