import { describe, expect, it, vi } from "vitest";
import { createWalletQualificationService } from "../src/qualification/service.ts";

describe("qualification policy", () => {
  const dependencies = {
    clock: () => new Date(),
    repository: { issue: vi.fn(), find: vi.fn(), settle: vi.fn() },
    verifier: { verify: vi.fn() },
    policy: {
      lifetimeMs: 300_000,
      maximumAttempts: 3,
      network: "signet",
      origin: "https://launch.example",
      providers: ["xverse"],
    },
  } as const;
  it.each([
    { origin: "https://launch.example/path" },
    { origin: "ftp://launch.example" },
    { lifetimeMs: 0 },
    { lifetimeMs: Number.NaN },
    { maximumAttempts: 0 },
    { maximumAttempts: 1.5 },
    { maximumAttempts: 2 ** 31 },
    { providers: [] },
    { providers: ["xverse", "xverse"] },
  ])("rejects invalid configuration %j", (override) => {
    expect(() =>
      createWalletQualificationService({
        ...dependencies,
        policy: { ...dependencies.policy, ...override },
      }),
    ).toThrow();
  });

  it("accepts the largest attempt bound the database column can hold", () => {
    expect(() =>
      createWalletQualificationService({
        ...dependencies,
        policy: { ...dependencies.policy, maximumAttempts: 2 ** 31 - 1 },
      }),
    ).not.toThrow();
  });
});
