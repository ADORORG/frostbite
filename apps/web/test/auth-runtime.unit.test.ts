import { beforeEach, describe, expect, it, vi } from "vitest";

const factories = vi.hoisted(() => ({
  authorizationRepository: vi.fn(() => "authorization-repository"),
  authorizationService: vi.fn(() => ({ forPlatform: vi.fn() })),
  client: vi.fn(() => "database-client"),
  heldKinds: vi.fn(() => "held-method-kinds"),
  environment: vi.fn(() => ({ database: "environment" })),
  pool: vi.fn(() => "database-pool"),
  sessionEnvironment: vi.fn(() => ({ AUTH_SESSION_IDLE_TIMEOUT_MS: 60_000 })),
  sessionRepository: vi.fn(() => "session-repository"),
  sessionService: vi.fn((input: { readonly clock: () => Date }) => {
    input.clock();
    return { find: vi.fn() };
  }),
}));

vi.mock("@frostbite/auth", () => ({
  createDrizzleSessionRepository: factories.sessionRepository,
  createSessionService: factories.sessionService,
}));
// The sign-in methods are the accounts feature's; this test is about how the adapters are put together, not which methods exist.
vi.mock("@frostbite/feature-accounts", () => ({
  createHeldMethodKinds: factories.heldKinds,
}));
vi.mock("@repo/configs/auth-methods", () => ({
  authMethods: { list: "the-method-registry" },
}));
vi.mock("@frostbite/authorization", () => ({
  createAuthorizationService: factories.authorizationService,
  createDrizzleAuthorizationRepository: factories.authorizationRepository,
}));
vi.mock("@frostbite/database/connection", () => ({
  createDatabaseClient: factories.client,
  createDatabasePool: factories.pool,
  parseDatabaseEnvironment: factories.environment,
}));
vi.mock("@repo/config/env", () => ({
  parseAuthSessionEnvironment: factories.sessionEnvironment,
}));

describe("page-access runtime composition", () => {
  beforeEach(() => vi.clearAllMocks());

  it("constructs the adapters once with validated configuration", async () => {
    const { getPageAccessDependencies } =
      await import("../src/server/auth/runtime.ts");

    const first = getPageAccessDependencies();
    const second = getPageAccessDependencies();

    expect(second).toBe(first);
    expect(factories.environment).toHaveBeenCalledWith(process.env);
    expect(factories.sessionEnvironment).toHaveBeenCalledWith(process.env);
    expect(factories.pool).toHaveBeenCalledWith({ database: "environment" });
    expect(factories.client).toHaveBeenCalledWith("database-pool");
    expect(factories.sessionRepository).toHaveBeenCalledWith("database-client");
    // Authorization asks the platform's sign-in methods which an account holds: the registry is built into the lookup it is given.
    expect(factories.heldKinds).toHaveBeenCalledWith({
      list: "the-method-registry",
    });
    expect(factories.authorizationRepository).toHaveBeenCalledWith(
      "database-client",
      "held-method-kinds",
    );
    expect(factories.sessionService).toHaveBeenCalledWith(
      expect.objectContaining({ idleLifetimeMs: 60_000 }),
    );
    expect(factories.authorizationService).toHaveBeenCalledOnce();
  });
});
