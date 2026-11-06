import { createUuidV7 } from "@frostbite/shared/identifiers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPasskeyLinkingService } from "../src/passkeys/service.ts";
import type { PasskeyRegistrationAdapter } from "../src/passkeys/contracts.ts";
import type {
  PasskeyRepository,
  StoredPasskeyChallenge,
} from "../src/passkeys/repository.ts";

const now = new Date("2026-09-10T12:00:00.000Z");
const userId = createUuidV7();
const sessionId = createUuidV7();
const correlationId = createUuidV7();
const session = {
  absoluteExpiresAt: new Date(now.getTime() + 60_000),
  authenticatedAt: now,
  idleExpiresAt: new Date(now.getTime() + 30_000),
  sessionId,
  userId,
};
const credential = {
  backedUp: true,
  counter: 0,
  credentialId: "credential-one",
  deviceType: "multiDevice" as const,
  publicKey: new Uint8Array([1, 2, 3]),
  transports: ["internal"] as const,
};

let stored: StoredPasskeyChallenge | null;
let completeKind: "conflict" | "invalid" | "linked" | "replayed";
let unlinkKind: "final-method" | "missing" | "unlinked";
const verify = vi.fn<PasskeyRegistrationAdapter["verify"]>();
const repository: PasskeyRepository = {
  completeLink: vi.fn(async () => ({ kind: completeKind })),
  findChallenge: vi.fn(async () => stored),
  issueChallenge: vi.fn(async (challenge) => {
    stored = challenge;
  }),
  listCredentialIds: vi.fn(async () => ["existing"]),
  unlink: vi.fn(async () => ({ kind: unlinkKind })),
};
const adapter: PasskeyRegistrationAdapter = {
  createOptions: vi.fn(
    async ({ challenge, relyingPartyId, userId, userName }) => ({
      challenge,
      pubKeyCredParams: [{ alg: -7, type: "public-key" as const }],
      rp: { id: relyingPartyId, name: "Launch" },
      user: { displayName: userName, id: userId, name: userName },
    }),
  ),
  verify,
};
const policy = {
  challengeLifetimeMs: 60_000,
  expectedOrigin: "https://launch.invalid",
  recentAuthenticationWindowMs: 10_000,
  relyingPartyId: "launch.invalid",
  relyingPartyName: "Launch",
  sessionAbsoluteLifetimeMs: 60_000,
  sessionIdleLifetimeMs: 30_000,
};

function service(clock = () => now) {
  return createPasskeyLinkingService({ adapter, clock, policy, repository });
}

function currentChallenge(): StoredPasskeyChallenge {
  if (!stored) throw new Error("Expected challenge");
  return stored;
}

describe("passkey linking service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stored = null;
    completeKind = "linked";
    unlinkKind = "unlinked";
    verify.mockResolvedValue(credential);
  });

  it("issues a session-bound registration challenge for recent auth", async () => {
    const result = await service().begin({ session, userName: "Player" });

    expect(result?.options).toHaveProperty("challenge");
    expect(stored).toMatchObject({
      origin: policy.expectedOrigin,
      relyingPartyId: policy.relyingPartyId,
      sessionId,
      userId,
    });
    expect(stored?.challengeHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("lists only credentials owned by the requested user", async () => {
    await expect(service().list(userId)).resolves.toEqual(["existing"]);
    expect(repository.listCredentialIds).toHaveBeenCalledWith(userId);
  });

  it("rejects enrollment when authentication is no longer recent", async () => {
    const stale = {
      ...session,
      authenticatedAt: new Date(now.getTime() - 10_001),
    };
    await expect(
      service().begin({ session: stale, userName: "Player" }),
    ).resolves.toBeNull();
    expect(repository.issueChallenge).not.toHaveBeenCalled();
  });

  it.each([
    ["conflict", "credential-conflict"],
    ["invalid", "challenge-invalid"],
    ["replayed", "challenge-replayed"],
  ] as const)(
    "maps repository %s without leaking ownership",
    async (kind, code) => {
      await service().begin({ session, userName: "Player" });
      completeKind = kind;
      await expect(
        service().finish({
          correlationId,
          challengeId: currentChallenge().challengeId,
          payload: payload(),
          session,
        }),
      ).resolves.toEqual({ code, ok: false });
    },
  );

  it("links once and returns only fresh session material", async () => {
    await service().begin({ session, userName: "Player" });
    const result = await service().finish({
      correlationId,
      challengeId: currentChallenge().challengeId,
      payload: payload(),
      session,
    });
    expect(result.ok).toBe(true);
    expect(repository.completeLink).toHaveBeenCalledOnce();
    if (result.ok) expect(result.sessionToken).not.toHaveLength(0);
  });

  it("rejects wrong-session, replayed, expired, and failed verification", async () => {
    await service().begin({ session, userName: "Player" });
    const challengeId = currentChallenge().challengeId;
    const wrong = { ...session, sessionId: createUuidV7() };
    await expect(
      service().finish({
        challengeId,
        correlationId,
        payload: payload(),
        session: wrong,
      }),
    ).resolves.toMatchObject({ code: "challenge-invalid" });
    stored = { ...currentChallenge(), consumedAt: now };
    await expect(
      service().finish({
        challengeId,
        correlationId,
        payload: payload(),
        session,
      }),
    ).resolves.toMatchObject({ code: "challenge-replayed" });
    stored = { ...currentChallenge(), consumedAt: null, expiresAt: now };
    await expect(
      service().finish({
        challengeId,
        correlationId,
        payload: payload(),
        session,
      }),
    ).resolves.toMatchObject({ code: "challenge-expired" });
    stored = { ...currentChallenge(), expiresAt: new Date(now.getTime() + 1) };
    verify.mockResolvedValueOnce(null);
    await expect(
      service().finish({
        challengeId,
        correlationId,
        payload: payload(),
        session,
      }),
    ).resolves.toMatchObject({ code: "challenge-invalid" });
  });

  it.each(["final-method", "missing"] as const)(
    "refuses unlink result %s",
    async (kind) => {
      unlinkKind = kind;
      await expect(
        service().unlink({
          correlationId,
          credentialId: "credential-one",
          session,
        }),
      ).resolves.toEqual({ code: kind, ok: false });
    },
  );

  it("unlinks after recent authentication and rotates the session", async () => {
    const result = await service().unlink({
      correlationId,
      credentialId: "credential-one",
      session,
    });
    expect(result.ok).toBe(true);
    expect(repository.unlink).toHaveBeenCalledOnce();
    if (result.ok) expect(result.sessionToken).not.toHaveLength(0);
  });

  it("rejects stale unlink and invalid policy", async () => {
    const stale = {
      ...session,
      authenticatedAt: new Date(now.getTime() - 10_001),
    };
    await expect(
      service().unlink({
        correlationId,
        credentialId: "credential-one",
        session: stale,
      }),
    ).resolves.toEqual({
      code: "recent-authentication-required",
      ok: false,
    });
    await expect(
      service().begin({
        session: {
          ...session,
          authenticatedAt: new Date(now.getTime() + 1),
        },
        userName: "Player",
      }),
    ).resolves.toBeNull();
    expect(() =>
      createPasskeyLinkingService({
        adapter,
        clock: () => now,
        policy: { ...policy, challengeLifetimeMs: 0 },
        repository,
      }),
    ).toThrow("policy is invalid");
    for (const invalid of [
      { ...policy, expectedOrigin: "not a URL" },
      { ...policy, expectedOrigin: "https://launch.invalid/path" },
      { ...policy, relyingPartyId: "wrong.invalid" },
      { ...policy, expectedOrigin: "http://launch.invalid" },
      { ...policy, recentAuthenticationWindowMs: 0 },
      { ...policy, sessionIdleLifetimeMs: 0 },
      { ...policy, sessionAbsoluteLifetimeMs: 1 },
    ]) {
      expect(() =>
        createPasskeyLinkingService({
          adapter,
          clock: () => now,
          policy: invalid,
          repository,
        }),
      ).toThrow("policy is invalid");
    }
  });

  it("rejects finish when the authenticated session becomes stale", async () => {
    await service().begin({ session, userName: "Player" });
    const stale = {
      ...session,
      authenticatedAt: new Date(now.getTime() - 10_001),
    };
    await expect(
      service().finish({
        correlationId,
        challengeId: currentChallenge().challengeId,
        payload: payload(),
        session: stale,
      }),
    ).resolves.toEqual({
      code: "recent-authentication-required",
      ok: false,
    });
    expect(adapter.verify).not.toHaveBeenCalled();
  });
});

function payload() {
  return {
    clientExtensionResults: {},
    id: "credential-one",
    rawId: "credential-one",
    response: { attestationObject: "value", clientDataJSON: "value" },
    type: "public-key" as const,
  };
}
