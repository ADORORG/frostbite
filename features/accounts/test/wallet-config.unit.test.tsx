import { describe, expect, it } from "vitest";

import { validateWalletAuthConfig } from "../src/wallet-config.ts";
import { walletConfig } from "./support/wallet-config.ts";

describe("the wallet sign-in settings", () => {
  it("accepts a working record and hands back a frozen copy", () => {
    const checked = validateWalletAuthConfig(walletConfig);
    expect(checked).toEqual(walletConfig);
    expect(Object.isFrozen(checked)).toBe(true);
    expect(Object.isFrozen(checked.candidates)).toBe(true);
    expect(Object.isFrozen(checked.candidates[0])).toBe(true);
  });

  it.each([
    [
      "no challenge lifetime",
      { challengeLifetimeMs: 0 },
      "Invalid wallet sign-in limits.",
    ],
    [
      "a fractional lifetime",
      { challengeLifetimeMs: 1.5 },
      "Invalid wallet sign-in limits.",
    ],
    [
      "no attempts allowed",
      { maximumVerificationAttempts: 0 },
      "Invalid wallet sign-in limits.",
    ],
    [
      "no hold on a removed wallet",
      { releaseHoldMs: 0 },
      "Invalid wallet sign-in limits.",
    ],
    ["no wallets", { candidates: [] }, "At least one wallet is required."],
    [
      "a wallet the connection library does not know",
      { candidates: [{ id: "nope" as never, label: "Nope" }] },
      "Unsupported wallet: nope.",
    ],
    [
      "a wallet without a label",
      { candidates: [{ id: "xverse" as const, label: "  " }] },
      "xverse requires a display label.",
    ],
    [
      "the same wallet twice",
      {
        candidates: [
          { id: "xverse" as const, label: "A" },
          { id: "xverse" as const, label: "B" },
        ],
      },
      "xverse is configured more than once.",
    ],
  ])("refuses %s, when the platform starts", (_why, override, message) => {
    expect(() =>
      validateWalletAuthConfig({ ...walletConfig, ...override }),
    ).toThrow(message);
  });
});
