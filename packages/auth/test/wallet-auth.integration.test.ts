import {
  authSessions,
  authUsers,
  walletChallenges,
  walletIdentities,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDrizzleSessionRepository } from "../src/adapters/drizzle-session-repository.ts";
import { createSessionService } from "../src/application/session-service.ts";
import {
  signWalletMessage,
  validChallengeInput,
  walletAuthPolicy,
} from "./support/fixtures.ts";
import {
  clock,
  database,
  issue,
  registerAuthDatabase,
  service,
  verifyIssued,
} from "./support/auth-database.ts";

registerAuthDatabase();

describe("wallet authentication", () => {
  it("persists a hashed challenge and creates a hashed revocable session", async () => {
    const issued = await issue();
    const signature = signWalletMessage(issued.message);
    const result = await service.verify({
      expectedAction: "sign-in",
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
      service.verify({
        expectedAction: "sign-in",
        challengeId: issued.challengeId,
        signature,
      }),
      service.verify({
        expectedAction: "sign-in",
        challengeId: issued.challengeId,
        signature,
      }),
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
      clock: () => clock.now,
      idleLifetimeMs: walletAuthPolicy.sessionIdleLifetimeMs,
      repository: createDrizzleSessionRepository(database),
    });
    clock.now = new Date(clock.now.getTime() + 1_000);
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
      service.verify({
        expectedAction: "sign-in",
        challengeId: issued.challengeId,
        signature: "bad",
      }),
    ).resolves.toEqual({ code: "signature-invalid", ok: false });
    await expect(
      service.verify({
        expectedAction: "sign-in",
        challengeId: issued.challengeId,
        signature: "bad",
      }),
    ).resolves.toEqual({ code: "signature-invalid", ok: false });
    await expect(
      service.verify({
        expectedAction: "sign-in",
        challengeId: issued.challengeId,
        signature: "bad",
      }),
    ).resolves.toEqual({ code: "challenge-invalid", ok: false });
    clock.now = new Date(issued.expiresAt.getTime());
    const expired = await issue();
    clock.now = expired.expiresAt;
    await expect(
      service.verify({
        expectedAction: "sign-in",
        challengeId: expired.challengeId,
        signature: "bad",
      }),
    ).resolves.toEqual({ code: "challenge-expired", ok: false });
    await expect(
      service.verify({
        expectedAction: "sign-in",
        challengeId: createUuidV7(),
        signature: "bad",
      }),
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
    await verifyIssued(linked, {
      expectedAction: "link-wallet",
      expectedUserId: firstResult.userId,
    });
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
    await expect(
      verifyIssued(stepUp, { expectedAction: "step-up", expectedUserId }),
    ).resolves.toEqual({
      code: "wallet-not-on-account",
      ok: false,
    });
    expect(await database.select().from(walletIdentities)).toHaveLength(0);
    const linked = await service.issue({
      ...validChallengeInput(),
      action: "link-wallet",
      expectedUserId,
    });
    if (linked === null) throw new Error("Expected link challenge");
    await expect(
      verifyIssued(linked, { expectedAction: "link-wallet", expectedUserId }),
    ).resolves.toMatchObject({
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
      service.verify({
        expectedAction: "sign-in",
        challengeId: tampered.challengeId,
        signature: "bad",
      }),
    ).resolves.toEqual({ code: "challenge-invalid", ok: false });

    const original = await issue();
    await service.verify({
      expectedAction: "sign-in",
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
    await expect(
      verifyIssued(linked, { expectedAction: "link-wallet", expectedUserId }),
    ).resolves.toEqual({
      code: "wallet-on-another-account",
      ok: false,
    });
  });
});
