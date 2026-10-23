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
      rpcHeaders: {},
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
      rpcHeaders: {},
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

  it("turns a key and its header name into the header the node is called with", () => {
    expect(
      parseRewardsChainEnvironment({
        ...node,
        REWARDS_CHAIN_RPC_API_KEY: " k3y-VALUE ",
        REWARDS_CHAIN_RPC_API_KEY_HEADER: " x-gateway-key ",
      })?.rpcHeaders,
    ).toEqual({ "x-gateway-key": "k3y-VALUE" });
  });

  it("treats blank key settings as none, and refuses a key without its header or the reverse", () => {
    expect(
      parseRewardsChainEnvironment({
        ...node,
        REWARDS_CHAIN_RPC_API_KEY: " ",
        REWARDS_CHAIN_RPC_API_KEY_HEADER: "",
      })?.rpcHeaders,
    ).toEqual({});
    for (const half of [
      { REWARDS_CHAIN_RPC_API_KEY: "k3y" },
      { REWARDS_CHAIN_RPC_API_KEY_HEADER: "x-gateway-key" },
    ]) {
      expect(() => parseRewardsChainEnvironment({ ...node, ...half })).toThrow(
        /together or not at all/u,
      );
    }
  });

  it("refuses a header name or key that could not be sent as an HTTP header", () => {
    const pair = {
      REWARDS_CHAIN_RPC_API_KEY: "k3y",
      REWARDS_CHAIN_RPC_API_KEY_HEADER: "x-gateway-key",
    };
    for (const bad of [
      { REWARDS_CHAIN_RPC_API_KEY_HEADER: "x gateway" },
      { REWARDS_CHAIN_RPC_API_KEY_HEADER: "x-key:" },
      { REWARDS_CHAIN_RPC_API_KEY: "two words" },
      { REWARDS_CHAIN_RPC_API_KEY: "line\nbreak" },
    ]) {
      expect(() =>
        parseRewardsChainEnvironment({ ...node, ...pair, ...bad }),
      ).toThrow();
    }
  });

  it("does not read the key while no node address is set", () => {
    expect(
      parseRewardsChainEnvironment({ REWARDS_CHAIN_RPC_API_KEY: "k3y" }),
    ).toBeNull();
  });
});
