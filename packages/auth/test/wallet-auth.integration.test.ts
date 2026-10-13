import {
  authSecurityEvents,
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  walletChallenges,
  walletIdentities,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleWalletAuthRepository } from "../src/adapters/drizzle-wallet-auth-repository.ts";
import { createDrizzleSessionRepository } from "../src/adapters/drizzle-session-repository.ts";
import { createWalletAuthService } from "../src/application/service.ts";
import { createSessionService } from "../src/application/session-service.ts";
import { strictBip322Verifier } from "../src/bitcoin/verifier.ts";
import {
  validChallengeInput,
  walletAuthPolicy,
  signWalletMessage,
} from "./support/fixtures.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleWalletAuthRepository(database);
let now = new Date("2026-09-08T12:00:00.000Z");

const service = createWalletAuthService({
  clock: () => now,
  policy: walletAuthPolicy,
  repository,
  verifier: strictBip322Verifier,
});

async function issue() {
  const challenge = await service.issue(validChallengeInput());
  if (challenge === null) throw new Error("Valid challenge was rejected");
  return challenge;
}

async function verifyIssued(challenge: Awaited<ReturnType<typeof issue>>) {
  return service.verify({
    challengeId: challenge.challengeId,
    signature: signWalletMessage(challenge.message),
  });
}

beforeAll(async () => {
  await runMigrations(environment);
});

beforeEach(async () => {
  // A wallet link records a security event that keeps its session and user, so the events go first.
  await database.delete(authSecurityEvents);
  await database.delete(authSessions);
  await database.delete(walletChallenges);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
  now = new Date("2026-09-08T12:00:00.000Z");
});

afterAll(async () => {
  await pool.end();
});

describe("wallet authentication", () => {
  it("persists a hashed challenge and creates a hashed revocable session", async () => {
    const issued = await issue();
    const signature = signWalletMessage(issued.message);
    const result = await service.verify({
      challengeId: issued.challengeId,
      signature,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected authentication success");

    const [storedChallenge] = await database.select().from(walletChallenges);
    const [session] = await database.select().from(authSessions);
    expect(storedChallenge?.messageHash).toMatch(/^[a-f\d]{64}$/u);
    expect(JSON.stringify(storedChallenge)).not.toContain(issued.message);
    expect(JSON.stringify(storedChallenge)).not.toContain(signature);
    expect(session?.tokenHash).toMatch(/^[a-f\d]{64}$/u);
    expect(session?.tokenHash).not.toBe(result.sessionToken);
    if (session === undefined) throw new Error("Expected a persisted session");
    expect(session.idleExpiresAt < session.absoluteExpiresAt).toBe(true);
  });

  it("allows exactly one concurrent consumer and rejects replay", async () => {
    const issued = await issue();
    const signature = signWalletMessage(issued.message);
    const results = await Promise.all([
      service.verify({ challengeId: issued.challengeId, signature }),
      service.verify({ challengeId: issued.challengeId, signature }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { code: "challenge-replayed", ok: false },
    ]);
    expect(await database.select().from(authSessions)).toHaveLength(1);
  });

  it("renews, caps, and revokes a session without accepting its stored hash", async () => {
    const issued = await issue();
    const result = await verifyIssued(issued);
    if (!result.ok) throw new Error("Expected authentication success");
    const sessions = createSessionService({
      clock: () => now,
      idleLifetimeMs: walletAuthPolicy.sessionIdleLifetimeMs,
      repository: createDrizzleSessionRepository(database),
    });
    now = new Date(now.getTime() + 1_000);
    const active = await sessions.find(result.sessionToken);
    expect(active?.userId).toBe(result.userId);
    const [stored] = await database.select().from(authSessions);
    if (stored === undefined) throw new Error("Expected session");
    await expect(sessions.find(stored.tokenHash)).resolves.toBeNull();
    await expect(sessions.revoke(result.sessionToken)).resolves.toBe(true);
    await expect(sessions.revoke(result.sessionToken)).resolves.toBe(false);
    await expect(sessions.find(result.sessionToken)).resolves.toBeNull();
    await expect(sessions.find("")).resolves.toBeNull();
    await expect(sessions.revoke("")).resolves.toBe(false);
  });

  it("limits invalid attempts and rejects expired or missing challenges", async () => {
    const issued = await issue();
    await expect(
      service.verify({ challengeId: issued.challengeId, signature: "bad" }),
    ).resolves.toEqual({ code: "signature-invalid", ok: false });
    await expect(
      service.verify({ challengeId: issued.challengeId, signature: "bad" }),
    ).resolves.toEqual({ code: "signature-invalid", ok: false });
    await expect(
      service.verify({ challengeId: issued.challengeId, signature: "bad" }),
    ).resolves.toEqual({ code: "challenge-invalid", ok: false });
    now = new Date(issued.expiresAt.getTime());
    const expired = await issue();
    now = expired.expiresAt;
    await expect(
      service.verify({ challengeId: expired.challengeId, signature: "bad" }),
    ).resolves.toEqual({ code: "challenge-expired", ok: false });
    await expect(
      service.verify({ challengeId: createUuidV7(), signature: "bad" }),
    ).resolves.toEqual({ code: "challenge-invalid", ok: false });
  });

  it("rejects unsafe request locations and user-required actions without a user", async () => {
    await expect(
      service.issue({
        ...validChallengeInput(),
        origin: "https://launch.example/extra",
      }),
    ).resolves.toBeNull();
    await expect(
      service.issue({
        ...validChallengeInput(),
        uri: "https://evil.example/auth",
      }),
    ).resolves.toBeNull();
    await expect(
      service.issue({ ...validChallengeInput(), action: "link-wallet" }),
    ).resolves.toBeNull();
    await expect(
      service.issue({
        ...validChallengeInput(),
        expectedUserId: createUuidV7(),
      }),
    ).resolves.toBeNull();
    await expect(
      service.issue({ ...validChallengeInput(), walletAdapter: "" }),
    ).resolves.toBeNull();
    await expect(
      service.issue({ ...validChallengeInput(), walletAdapter: " lasereyes" }),
    ).resolves.toBeNull();
    await expect(
      service.issue({
        ...validChallengeInput(),
        origin: "ftp://launch.example",
        uri: "ftp://launch.example/auth/wallet",
      }),
    ).resolves.toBeNull();
    await expect(
      service.issue({ ...validChallengeInput(), origin: "not a URL" }),
    ).resolves.toBeNull();
  });
  it("reuses an existing identity without creating duplicate users", async () => {
    const first = await issue();
    const firstResult = await verifyIssued(first);
    const second = await issue();
    const secondResult = await verifyIssued(second);
    expect(
      firstResult.ok &&
        secondResult.ok &&
        firstResult.userId === secondResult.userId,
    ).toBe(true);
    expect(await database.select().from(authUsers)).toHaveLength(1);
    if (!firstResult.ok) throw new Error("Expected initial authentication");
    const linked = await service.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId: firstResult.userId,
    });
    if (linked === null) throw new Error("Expected link challenge");
    await verifyIssued(linked);
    const storedSessions = await database.select().from(authSessions);
    expect(
      storedSessions.filter((session) => session.revokedAt === null),
    ).toHaveLength(1);
    expect(
      storedSessions.filter((session) => session.revokedAt !== null),
    ).toHaveLength(2);
  });

  it("links a previously unseen wallet to an existing user", async () => {
    const expectedUserId = createUuidV7();
    await database.insert(authUsers).values({
      email: `wallet-${expectedUserId}@wallet.invalid`,
      id: expectedUserId,
      name: "Existing user",
    });
    const stepUp = await service.issue({
      ...validChallengeInput(),
      action: "step-up",
      expectedUserId,
    });
    if (stepUp === null) throw new Error("Expected step-up challenge");
    await expect(verifyIssued(stepUp)).resolves.toEqual({
      code: "identity-conflict",
      ok: false,
    });
    expect(await database.select().from(walletIdentities)).toHaveLength(0);
    const linked = await service.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId,
    });
    if (linked === null) throw new Error("Expected link challenge");
    await expect(verifyIssued(linked)).resolves.toMatchObject({
      ok: true,
      userId: expectedUserId,
    });
    expect(await database.select().from(walletIdentities)).toHaveLength(1);
  });

  it("rejects challenge-state tampering and an identity owned by another user", async () => {
    const tampered = await issue();
    await database
      .update(walletChallenges)
      .set({ messageHash: "0".repeat(64) })
      .where(eq(walletChallenges.id, tampered.challengeId));
    await expect(
      service.verify({ challengeId: tampered.challengeId, signature: "bad" }),
    ).resolves.toEqual({ code: "challenge-invalid", ok: false });

    const original = await issue();
    await service.verify({
      challengeId: original.challengeId,
      signature: signWalletMessage(original.message),
    });
    const expectedUserId = createUuidV7();
    await database.insert(authUsers).values({
      email: `wallet-${expectedUserId}@wallet.invalid`,
      id: expectedUserId,
      name: "Second user",
    });
    const linked = await service.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId,
    });
    if (linked === null) throw new Error("Expected link challenge");
    await expect(verifyIssued(linked)).resolves.toEqual({
      code: "identity-conflict",
      ok: false,
    });
  });

  it("enforces protocol and hash invariants in PostgreSQL", async () => {
    const issued = await issue();
    await expect(
      database
        .update(walletChallenges)
        .set({ messageHash: "not-a-sha256-hash" })
        .where(eq(walletChallenges.id, issued.challengeId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(
      database
        .update(walletChallenges)
        .set({ network: "testnet" })
        .where(eq(walletChallenges.id, issued.challengeId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });

    const result = await verifyIssued(issued);
    if (!result.ok) throw new Error("Expected authentication success");
    await expect(
      database.update(authSessions).set({ tokenHash: result.sessionToken }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
