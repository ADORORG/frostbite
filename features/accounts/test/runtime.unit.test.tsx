import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountMethods } from "../src/runtime.ts";

const factories = vi.hoisted(() => ({
  authEnvironment: vi.fn(() => ({
    AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: 604_800_000,
    AUTH_SESSION_IDLE_TIMEOUT_MS: 86_400_000,
    PASSKEY_CHALLENGE_TIMEOUT_MS: 300_000,
    PASSKEY_RECENT_AUTH_WINDOW_MS: 600_000,
  })),
  databaseClient: vi.fn(() => "database"),
  databaseEnvironment: vi.fn(() => "database-environment"),
  databasePool: vi.fn(() => "pool"),
  passkeyRepository: vi.fn(() => "repository"),
  signInRepository: vi.fn(() => "sign-in-repository"),
  signInService: vi.fn(() => ({ signInService: true })),
  passkeyService: vi.fn((input: { readonly clock: () => Date }) => {
    input.clock();
    return { service: true };
  }),
  platformEnvironment: vi.fn(() => ({
    APP_ENV: "test",
    NEXT_PUBLIC_APP_NAME: "Launch",
    PUBLIC_BASE_URL: "https://launch.invalid/path",
  })),
}));

vi.mock("@ador/auth", () => ({
  createDrizzlePasskeyRepository: factories.passkeyRepository,
  createDrizzlePasskeySignInRepository: factories.signInRepository,
  createPasskeyLinkingService: factories.passkeyService,
  createPasskeySignInService: factories.signInService,
  simpleWebAuthnAuthenticationAdapter: "authentication-adapter",
  simpleWebAuthnRegistrationAdapter: "adapter",
}));
vi.mock("@ador/database/connection", () => ({
  createDatabaseClient: factories.databaseClient,
  createDatabasePool: factories.databasePool,
  parseDatabaseEnvironment: factories.databaseEnvironment,
}));
vi.mock("@repo/config/env", () => ({
  parseAuthSessionEnvironment: factories.authEnvironment,
  parseEnvironment: factories.platformEnvironment,
}));

// The deployment's method registry, as the feature is given it.
const methods: AccountMethods = {
  describe: () => [
    { assurance: "strong", canSignIn: true, kind: "wallet" },
    { assurance: "basic", canSignIn: false, kind: "phone" },
    { assurance: "standard", canSignIn: true, kind: "email" },
  ],
  list: vi.fn(async () => []),
};

describe("passkey runtime composition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds one service from validated provider-neutral configuration", async () => {
    const { createPasskeyServiceResolver } = await import("../src/runtime.ts");
    const getService = createPasskeyServiceResolver(methods);
    const first = getService();
    const second = getService();
    expect(second).toBe(first);
    // The repository removes a passkey under the registry's rule: it is handed the registry's listing.
    expect(factories.passkeyRepository).toHaveBeenCalledWith(
      "database",
      methods.list,
    );
    expect(factories.passkeyService).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: "adapter",
        policy: {
          challengeLifetimeMs: 300_000,
          expectedOrigin: "https://launch.invalid",
          recentAuthenticationWindowMs: 600_000,
          relyingPartyId: "launch.invalid",
          relyingPartyName: "Launch",
          sessionAbsoluteLifetimeMs: 604_800_000,
          sessionIdleLifetimeMs: 86_400_000,
        },
        repository: "repository",
      }),
    );
  });

  it("offers on the sign-in page the registered methods that can start a session, in registration order, and not one that can only be linked", async () => {
    const { offeredSignInKinds } = await import("../src/runtime.ts");
    expect(offeredSignInKinds(methods)).toEqual(["wallet", "email"]);
  });

  it("builds one passkey sign-in service, under the same policy as linking, over the real repository", async () => {
    const { createPasskeySignInResolver } = await import("../src/runtime.ts");
    const getService = createPasskeySignInResolver();
    const first = getService();
    expect(getService()).toBe(first);
    expect(factories.signInService).toHaveBeenCalledOnce();
    expect(factories.signInRepository).toHaveBeenCalledWith("database");
    expect(factories.signInService).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: "authentication-adapter",
        policy: expect.objectContaining({
          challengeLifetimeMs: 300_000,
          expectedOrigin: "https://launch.invalid",
          relyingPartyId: "launch.invalid",
          sessionAbsoluteLifetimeMs: 604_800_000,
          sessionIdleLifetimeMs: 86_400_000,
        }),
        repository: "sign-in-repository",
      }),
    );
  });
});
