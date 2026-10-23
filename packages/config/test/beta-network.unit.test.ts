import { describe, expect, it } from "vitest";

import { parseBetaNetworkEnvironment } from "../src/env/beta-network.ts";

describe("BETA_NETWORK", () => {
  it.each([undefined, "", "  "])("means signet when it is %j", (value) => {
    expect(parseBetaNetworkEnvironment({ BETA_NETWORK: value })).toBe("signet");
  });

  it("reads signet and testnet4, ignoring the spaces around them", () => {
    expect(parseBetaNetworkEnvironment({ BETA_NETWORK: " testnet4 " })).toBe(
      "testnet4",
    );
    expect(parseBetaNetworkEnvironment({ BETA_NETWORK: "signet" })).toBe(
      "signet",
    );
  });

  it.each(["mainnet", "regtest", "testnet", "Signet", "testnet4,signet"])(
    "stops boot on %j, naming the setting and what is allowed",
    (value) => {
      expect(() =>
        parseBetaNetworkEnvironment({ BETA_NETWORK: value }),
      ).toThrow(/BETA_NETWORK must be one of signet, testnet4/u);
    },
  );
});
