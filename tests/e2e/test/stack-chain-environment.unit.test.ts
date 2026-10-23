import { describe, expect, it } from "vitest";

import {
  chainSettingsFrom,
  describeChain,
} from "../src/stack-chain-environment.ts";

const file = [
  "BETA_NETWORK=testnet4",
  "REWARDS_CHAIN_RPC_URL=https://node.example/v4/jsonrpc",
  "REWARDS_CHAIN_RPC_API_KEY=k3y",
  "REWARDS_TEMPLATES_DIR=",
  "DATABASE_URL=postgres://real.example/db",
  "R2_SECRET_ACCESS_KEY=secret",
  "# REWARDS_MAX_FEE_SATS=1",
  "REWARDS_MAX_FEE_SATS=500000",
].join("\n");

describe("the chain settings the stack takes from the settings file", () => {
  it("takes the network and the rewards settings, and nothing else", () => {
    expect(chainSettingsFrom(file, {})).toEqual({
      BETA_NETWORK: "testnet4",
      REWARDS_CHAIN_RPC_API_KEY: "k3y",
      REWARDS_CHAIN_RPC_URL: "https://node.example/v4/jsonrpc",
      REWARDS_MAX_FEE_SATS: "500000",
    });
  });

  it("leaves blank settings out and lets the shell win over the file", () => {
    const settings = chainSettingsFrom(file, { BETA_NETWORK: "signet" });
    expect(settings).not.toHaveProperty("BETA_NETWORK");
    expect(settings).not.toHaveProperty("REWARDS_TEMPLATES_DIR");
  });

  it("is empty when there is no file", () => {
    expect(chainSettingsFrom(null, {})).toEqual({});
  });
});

describe("what the stack says about the chain", () => {
  it("names the network and the node's host, never its address or key", () => {
    const text = describeChain({
      BETA_NETWORK: "testnet4",
      REWARDS_CHAIN_RPC_API_KEY: "k3y",
      REWARDS_CHAIN_RPC_URL: "https://node.example/v4/s3cret",
    });
    expect(text).toContain("testnet4");
    expect(text).toContain("node.example");
    expect(text).not.toContain("s3cret");
    expect(text).not.toContain("k3y");
  });

  it("says signet while the network is blank, and says so when there is no chain", () => {
    expect(
      describeChain({ REWARDS_CHAIN_RPC_URL: "https://node.example/rpc" }),
    ).toContain("signet");
    expect(describeChain({})).toContain("No rewards chain");
    expect(describeChain({ REWARDS_CHAIN_RPC_URL: "not a url" })).toContain(
      "not a URL",
    );
  });
});
