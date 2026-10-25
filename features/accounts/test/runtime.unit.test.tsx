import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountMethods } from "../src/runtime.ts";

const factories = vi.hoisted(() => ({
  authEnvironment: vi.fn(() => ({
    AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: 604_800_000,
    AUTH_SESSION_IDLE_TIMEOUT_MS: 86_400_000,
    PASSKEY_CHALLENGE_TIMEOUT_MS: 300_000,
    PASSKEY_RECENT_AUTH_WINDOW_MS: 600_000,
  })),
  contactRepository: vi.fn(() => "contact-repository"),
  contactService: vi.fn(() => ({ contactService: true })),
  linkRepository: vi.fn(() => "link-repository"),
  linkService: vi.fn(() => ({ linkService: true })),
  databaseClient: vi.fn(() => "database"),
  emailChannel: vi.fn(() => "email-channel"),
  mailSender: vi.fn(
    (_settings: object, input: { readonly clock: () => Date }) => {
      input.clock();
      return "mail-sender";
    },
  ),
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

vi.mock("@ador/mail", () => ({ createMailSender: factories.mailSender }));
vi.mock("@ador/auth", () => ({
  createContactCodeService: factories.contactService,
  createContactLinkService: factories.linkService,
  createDrizzleContactLinkRepository: factories.linkRepository,
  createDrizzleContactCodeRepository: factories.contactRepository,
  createEmailChannel: factories.emailChannel,
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

  it("builds the code service once, with an email channel made from the mail settings and the policy, under the platform's session lifetimes", async () => {
    const { createEmailResolvers } = await import("../src/runtime.ts");
    const policy = {
      codeLength: 6,
      lifetimeMs: 600_000,
      maximumAttempts: 5,
      maximumSendsPerWindow: 5,
      resendCooldownMs: 60_000,
      sendWindowMs: 3_600_000,
    };
    const mail = {
      directory: "inbox",
      from: "login@launch.invalid",
      transport: "capture",
    } as const;
    const emails = createEmailResolvers({ mail, policy }, methods);
    const first = emails.codes();
    expect(emails.codes()).toBe(first);
    expect(factories.contactService).toHaveBeenCalledOnce();
    expect(factories.mailSender).toHaveBeenCalledWith(mail, {
      clock: expect.any(Function),
    });
    expect(factories.emailChannel).toHaveBeenCalledWith({
      appName: "Launch",
      policy,
      sender: "mail-sender",
    });
    expect(factories.contactRepository).toHaveBeenCalledWith("database");
    expect(factories.contactService).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ["email-channel"],
        repository: "contact-repository",
        sessions: {
          sessionAbsoluteLifetimeMs: 604_800_000,
          sessionIdleLifetimeMs: 86_400_000,
        },
      }),
    );
  });

  it("has no channel at all while the deployment has no mail, and builds no sender", async () => {
    const { createEmailResolvers } = await import("../src/runtime.ts");
    createEmailResolvers(null, methods).codes();
    expect(factories.mailSender).not.toHaveBeenCalled();
    expect(factories.emailChannel).not.toHaveBeenCalled();
    expect(factories.contactService).toHaveBeenCalledWith(
      expect.objectContaining({ channels: [] }),
    );
  });

  it("builds the link service with the same channel and code service, the registry's listing for the removal rule, and the recent-sign-in window", async () => {
    const { createEmailResolvers } = await import("../src/runtime.ts");
    const policy = {
      codeLength: 6,
      lifetimeMs: 600_000,
      maximumAttempts: 5,
      maximumSendsPerWindow: 5,
      resendCooldownMs: 60_000,
      sendWindowMs: 3_600_000,
    };
    const mail = {
      directory: "inbox",
      from: "login@launch.invalid",
      transport: "capture",
    } as const;
    const emails = createEmailResolvers({ mail, policy }, methods);
    const links = emails.links();
    expect(emails.links()).toBe(links);
    // One service of each, and one channel and one sender between them.
    expect(factories.contactService).toHaveBeenCalledOnce();
    expect(factories.emailChannel).toHaveBeenCalledOnce();
    expect(factories.linkRepository).toHaveBeenCalledWith(
      "database",
      methods.list,
    );
    expect(factories.linkService).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ["email-channel"],
        codes: expect.objectContaining({ contactService: true }),
        policy: {
          recentAuthenticationWindowMs: 600_000,
          sessionAbsoluteLifetimeMs: 604_800_000,
          sessionIdleLifetimeMs: 86_400_000,
        },
        repository: "link-repository",
      }),
    );
  });
});
