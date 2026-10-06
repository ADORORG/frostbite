import { describe, expect, it } from "vitest";
import { validateWalletConnectionConfig } from "../src/config.ts";
import { walletQualificationDefaults } from "@ador/shared/wallet-qualification";

const valid = {
  candidates: [{ id: "xverse", label: "Xverse" }],
  network: "signet",
} as const;

describe("wallet connection configuration", () => {
  it("returns immutable validated configuration", () => {
    const config = validateWalletConnectionConfig(valid);
    expect(config).toEqual({
      ...valid,
      qualification: walletQualificationDefaults,
    });
    expect(Reflect.set(config, "network", "mainnet")).toBe(false);
    expect(Reflect.set(config.candidates, "0", null)).toBe(false);
    expect(Reflect.set(config.candidates[0] ?? {}, "label", "Changed")).toBe(
      false,
    );
  });

  it.each([
    { lifetimeMs: 0, maximumAttempts: 3 },
    { lifetimeMs: 300_000, maximumAttempts: 0 },
    { lifetimeMs: 1.5, maximumAttempts: 3 },
    { lifetimeMs: 300_000, maximumAttempts: 1.5 },
    { lifetimeMs: 300_000, maximumAttempts: 2 ** 31 },
  ])("rejects invalid qualification limits %j", (qualification) => {
    expect(() =>
      validateWalletConnectionConfig({ ...valid, qualification }),
    ).toThrow("qualification limits");
  });

  it("accepts the largest attempt bound the database column can hold", () => {
    expect(
      validateWalletConnectionConfig({
        ...valid,
        qualification: { lifetimeMs: 300_000, maximumAttempts: 2 ** 31 - 1 },
      }).qualification?.maximumAttempts,
    ).toBe(2 ** 31 - 1);
  });

  it.each([
    [{ ...valid, candidates: [] }, "At least one"],
    [{ ...valid, candidates: [{ id: "xverse", label: " " }] }, "display label"],
    [
      { ...valid, candidates: [...valid.candidates, ...valid.candidates] },
      "more than once",
    ],
  ] as const)("rejects invalid candidate configuration", (input, message) => {
    expect(() => validateWalletConnectionConfig(input)).toThrow(message);
  });

  it("rejects a provider outside the pinned LaserEyes artifact", () => {
    const input = {
      candidates: [{ id: "xverse", label: "Xverse" }],
      network: "signet",
    } satisfies Parameters<typeof validateWalletConnectionConfig>[0];
    Reflect.set(input.candidates[0] ?? {}, "id", "not-a-wallet");
    expect(() => validateWalletConnectionConfig(input)).toThrow(
      "Unsupported LaserEyes provider",
    );
  });
});
