import { describe, expect, it, vi } from "vitest";
const factories = vi.hoisted(() => ({
  service: vi.fn((input: { clock: () => Date }) => {
    input.clock();
    return { qualified: true };
  }),
  repository: vi.fn(() => "repository"),
  client: vi.fn(() => "database"),
  pool: vi.fn(() => "pool"),
  environment: vi.fn(() => "database-environment"),
}));
vi.mock("@ador/auth/qualification", () => ({
  createWalletQualificationService: factories.service,
}));
vi.mock("@ador/auth/qualification-repository", () => ({
  createDrizzleQualificationRepository: factories.repository,
}));
vi.mock("@ador/auth/bitcoin", () => ({ strictBip322Verifier: "verifier" }));
vi.mock("@ador/database/connection", () => ({
  createDatabaseClient: factories.client,
  createDatabasePool: factories.pool,
  parseDatabaseEnvironment: factories.environment,
}));
vi.mock("@repo/config/env", () => ({
  parseEnvironment: () => ({ PUBLIC_BASE_URL: "https://launch.example/base" }),
}));
import { createQualificationRuntime } from "../src/runtime.ts";

describe("qualification runtime", () => {
  it("lazily composes and caches a scoped provider-neutral service", () => {
    const resolve = createQualificationRuntime({
      candidates: [{ id: "xverse", label: "Xverse" }],
      network: "signet",
    });
    expect(factories.service).not.toHaveBeenCalled();
    expect(resolve()).toBe(resolve());
    expect(factories.service).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        policy: {
          lifetimeMs: 300_000,
          maximumAttempts: 3,
          network: "signet",
          origin: "https://launch.example",
          providers: ["xverse"],
        },
        repository: "repository",
        verifier: "verifier",
      }),
    );
    expect(factories.repository).toHaveBeenCalledWith("database");
    createQualificationRuntime({
      candidates: [{ id: "oyl", label: "Oyl" }],
      network: "signet",
      qualification: { lifetimeMs: 60_000, maximumAttempts: 1 },
    })();
    expect(factories.service).toHaveBeenLastCalledWith(
      expect.objectContaining({
        policy: expect.objectContaining({
          lifetimeMs: 60_000,
          maximumAttempts: 1,
          providers: ["oyl"],
        }),
      }),
    );
  });
});
