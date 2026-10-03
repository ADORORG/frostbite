import { describe, expect, it } from "vitest";
import { walletNetworkUnavailableReason } from "../src/client/network-availability.ts";

describe("pinned adapter network availability", () => {
  it.each(["signet"] as const)(
    "reports the Phantom adapter rejection on %s",
    (network) => {
      expect(walletNetworkUnavailableReason("phantom", network)).toContain(
        network,
      );
    },
  );
  it("does not classify a usable connection as qualified", () => {
    expect(walletNetworkUnavailableReason("phantom", "mainnet")).toBeNull();
    expect(walletNetworkUnavailableReason("xverse", "signet")).toBeNull();
  });
});
