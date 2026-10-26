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
      feeSource: { kind: "default" },
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
      feeSource: { kind: "default" },
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

  describe("the fee source", () => {
    it("is the network's own explorer unless one of the two settings is given", () => {
      expect(parseRewardsChainEnvironment(node)?.feeSource).toEqual({
        kind: "default",
      });
      expect(
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_URL: "  ",
          REWARDS_FEE_RATE_SAT_VB: " ",
        })?.feeSource,
      ).toEqual({ kind: "default" });
    });

    it("can be another explorer, whose address is read as typed once trimmed", () => {
      expect(
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_URL: " https://fees.example.org/signet ",
        })?.feeSource,
      ).toEqual({
        format: "mempool",
        kind: "explorer",
        url: "https://fees.example.org/signet",
      });
    });

    it("reads the explorer in the format named, trimmed; a blank format is the default", () => {
      const withFormat = (REWARDS_FEE_API_FORMAT: string) =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_FORMAT,
          REWARDS_FEE_API_URL: "https://fees.example.org/signet",
        })?.feeSource;
      expect(withFormat(" esplora ")).toEqual({
        format: "esplora",
        kind: "explorer",
        url: "https://fees.example.org/signet",
      });
      expect(withFormat(" ")).toMatchObject({ format: "mempool" });
    });

    it("refuses a format it does not know, and a format with no explorer to apply it to", () => {
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_FORMAT: "blockbook",
          REWARDS_FEE_API_URL: "https://fees.example.org/signet",
        }),
      ).toThrow();
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_FORMAT: "esplora",
        }),
      ).toThrow("needs REWARDS_FEE_API_URL");
    });

    it("can be a fixed rate, which may have a fraction", () => {
      expect(
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_RATE_SAT_VB: "2.5",
        })?.feeSource,
      ).toEqual({
        kind: "fixed",
        satPerVb: 2.5,
      });
    });

    it("refuses both together, an address that is not a web address, and a rate that is zero, negative, not a number or implausibly large", () => {
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_URL: "https://a.example.org",
          REWARDS_FEE_RATE_SAT_VB: "2",
        }),
      ).toThrow("alternatives");
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_URL: "ftp://a.example.org",
        }),
      ).toThrow();
      expect(() =>
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_API_URL: "not a url",
        }),
      ).toThrow();
      for (const bad of ["0", "-1", "fast", "1000.01", "588235"])
        expect(() =>
          parseRewardsChainEnvironment({
            ...node,
            REWARDS_FEE_RATE_SAT_VB: bad,
          }),
        ).toThrow();
      expect(
        parseRewardsChainEnvironment({
          ...node,
          REWARDS_FEE_RATE_SAT_VB: "1000",
        })?.feeSource,
      ).toEqual({
        kind: "fixed",
        satPerVb: 1000,
      });
    });
  });
});
