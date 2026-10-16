import { describe, expect, it } from "vitest";

import { parseRewardsChainEnvironment } from "../src/env/rewards-chain.ts";

const node = {
  REWARDS_CHAIN_RPC_URL: "https://node.example.invalid/rpc",
  REWARDS_MAX_FEE_SATS: "20000",
};
const templates = {
  REWARDS_TEMPLATES_DIR: "/srv/templates",
  REWARDS_TEMPLATE_IDS: JSON.stringify({
    "game-rewards": "4:100",
    "milestone-collectible": "4:101",
  }),
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

  it("reads a node with the safe defaults: a closed gate, no templates, no contracts", () => {
    expect(parseRewardsChainEnvironment(node)).toEqual({
      contracts: new Map(),
      maxFeeSats: 20_000n,
      releaseGate: "closed",
      rpcTimeoutMs: 15_000,
      rpcUrl: "https://node.example.invalid/rpc",
      templates: null,
    });
  });

  it("reads every setting when all are given", () => {
    const environment = parseRewardsChainEnvironment({
      ...node,
      ...templates,
      REWARDS_CHAIN_RELEASE_GATE: "open",
      REWARDS_CHAIN_RPC_TIMEOUT_MS: "5000",
      REWARDS_CONTRACTS: JSON.stringify({
        arcade: { id: "4:200", maxDrawingBytes: 4096 },
      }),
    });
    expect(environment?.releaseGate).toBe("open");
    expect(environment?.rpcTimeoutMs).toBe(5000);
    expect(environment?.templates).toEqual({
      directory: "/srv/templates",
      ids: { "game-rewards": "4:100", "milestone-collectible": "4:101" },
    });
    expect(environment?.contracts.get("arcade")).toEqual({
      id: "4:200",
      maxDrawingBytes: 4096n,
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

  it("refuses an address that is not http or https, a bad gate, and a bad timeout", () => {
    for (const bad of [
      { REWARDS_CHAIN_RPC_URL: "ftp://node.example.invalid" },
      { REWARDS_CHAIN_RPC_URL: "not a url" },
      { REWARDS_CHAIN_RELEASE_GATE: "ajar" },
      { REWARDS_CHAIN_RPC_TIMEOUT_MS: "0" },
    ]) {
      expect(() => parseRewardsChainEnvironment({ ...node, ...bad })).toThrow();
    }
  });

  it("wants the templates directory and the template ids together", () => {
    expect(() =>
      parseRewardsChainEnvironment({
        ...node,
        REWARDS_TEMPLATES_DIR: templates.REWARDS_TEMPLATES_DIR,
      }),
    ).toThrow(/together/u);
    expect(() =>
      parseRewardsChainEnvironment({
        ...node,
        REWARDS_TEMPLATE_IDS: templates.REWARDS_TEMPLATE_IDS,
      }),
    ).toThrow(/together/u);
  });

  it("names the setting when a JSON value is wrong", () => {
    const badIds = [
      "{",
      "[]",
      JSON.stringify({ "game-rewards": "4:100" }),
      JSON.stringify({
        "game-rewards": "4:100",
        "milestone-collectible": "x",
      }),
    ];
    for (const ids of badIds) {
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          ...templates,
          REWARDS_TEMPLATE_IDS: ids,
        }),
      ).toThrow(/REWARDS_TEMPLATE_IDS/u);
    }
    for (const contracts of [
      "{",
      JSON.stringify({ arcade: { id: "4:1" } }),
      JSON.stringify({ arcade: { id: "4:1", maxDrawingBytes: 0 } }),
    ]) {
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_CONTRACTS: contracts,
        }),
      ).toThrow(/REWARDS_CONTRACTS/u);
    }
  });
});
