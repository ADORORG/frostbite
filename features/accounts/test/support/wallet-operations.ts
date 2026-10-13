import type { WalletAuthServices } from "../../src/application/wallet-services.ts";
import type { HttpOperationContext } from "@ador/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { vi } from "vitest";

export const origin = "https://launch.example";
export const address = "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v";
export const walletRequest = {
  address,
  network: "signet",
  walletAdapter: "xverse",
} as const;
export const challengeId = createUuidV7();

export function session(ageMs = 0) {
  const now = Date.now();
  return {
    absoluteExpiresAt: new Date(now + 3_600_000),
    authenticatedAt: new Date(now - ageMs),
    idleExpiresAt: new Date(now + 3_600_000),
    sessionId: createUuidV7(),
    userId: createUuidV7(),
  };
}
export const signedIn = (actorSession = session()): HttpOperationContext => ({
  actorSession,
  actorUserId: actorSession.userId,
  correlationId: createUuidV7(),
});
export const anonymous: HttpOperationContext = {
  actorSession: null,
  actorUserId: null,
  correlationId: createUuidV7(),
};

export function services(overrides: Partial<WalletAuthServices> = {}) {
  const issue = vi.fn(async () => ({
    challengeId,
    expiresAt: new Date("2026-10-13T12:05:00.000Z"),
    message: "the message to sign",
    signatureScheme: "bip322-simple" as const,
  }));
  const verify = vi.fn(async () => ({
    ok: true as const,
    sessionToken: "fresh-token",
    userId: createUuidV7(),
  }));
  const unlink = vi.fn(async () => ({
    ok: true as const,
    sessionToken: "rotated-token",
  }));
  const list = vi.fn(async () => []);
  const revokeSession = vi.fn(async () => true);
  const value = {
    auth: { issue, verify },
    methods: { list, unlink },
    origin,
    passkeys: { list: vi.fn(async () => ["credential-1"]) },
    recentAuthenticationWindowMs: 600_000,
    sessions: { revokeSession },
    ...overrides,
  } as unknown as WalletAuthServices;
  return { issue, list, revokeSession, services: value, unlink, verify };
}
