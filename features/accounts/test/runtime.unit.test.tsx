import { beforeEach, describe, expect, it, vi } from "vitest";

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
  methodRegistry: vi.fn<
    (adapters: readonly string[]) => { describe: () => unknown; list: string }
  >(() => ({
    describe: () => [
      { assurance: "strong", canSignIn: true, kind: "wallet" },
      { assurance: "strong", canSignIn: false, kind: "passkey" },
      { assurance: "standard", canSignIn: true, kind: "email" },
    ],
    list: "list-methods",
  })),
  passkeyRepository: vi.fn(() => "repository"),
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
  createMethodRegistry: factories.methodRegistry,
  createPasskeyLinkingService: factories.passkeyService,
  passkeyMethod: "passkey-method",
  simpleWebAuthnRegistrationAdapter: "adapter",
  walletMethod: "wallet-method",
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

describe("passkey runtime composition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds one service from validated provider-neutral configuration", async () => {
    const { getPasskeyLinkingService } = await import("../src/runtime.ts");
    const first = getPasskeyLinkingService();
    const second = getPasskeyLinkingService();
    expect(second).toBe(first);
    // The repository removes a passkey under the registry's rule, and the registry is the wallet and passkey methods.
    expect(factories.methodRegistry).toHaveBeenCalledWith([
      "wallet-method",
      "passkey-method",
    ]);
    expect(factories.passkeyRepository).toHaveBeenCalledWith(
      "database",
      "list-methods",
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

  it("offers on the sign-in page the registered methods that can start a session, in registration order, and not a passkey, which cannot yet", async () => {
    const { offeredSignInKinds } = await import("../src/runtime.ts");
    expect(offeredSignInKinds()).toEqual(["wallet", "email"]);
  });
});
