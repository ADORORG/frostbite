import {
  authSessions,
  authSecurityEvents,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  passkeyChallenges,
  passkeyCredentials,
  runMigrations,
  walletIdentities,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzlePasskeyRepository } from "../src/passkeys/drizzle-repository.ts";
import { listMethods } from "./support/registry.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzlePasskeyRepository(database, listMethods);
const now = new Date("2026-09-10T12:00:00.000Z");
let userId = createUuidV7();
let sessionId = createUuidV7();

beforeAll(async () => runMigrations(environment));
afterAll(async () => pool.end());
beforeEach(async () => {
  await database.delete(authSecurityEvents);
  await database.delete(passkeyCredentials);
  await database.delete(passkeyChallenges);
  await database.delete(authSessions);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
  userId = createUuidV7();
  sessionId = createUuidV7();
  await database.insert(authUsers).values({
    email: `${userId}@wallet.invalid`,
    id: userId,
    name: "Passkey user",
  });
  await database.insert(authSessions).values({
    absoluteExpiresAt: new Date(now.getTime() + 60_000),
    authenticatedAt: now,
    id: sessionId,
    idleExpiresAt: new Date(now.getTime() + 30_000),
    tokenHash: "1".repeat(64),
    userId,
  });
});

function challenge() {
  return {
    challengeHash: "2".repeat(64),
    challengeId: createUuidV7(),
    consumedAt: null,
    expiresAt: new Date(now.getTime() + 10_000),
    issuedAt: now,
    origin: "https://launch.invalid",
    relyingPartyId: "launch.invalid",
    sessionId,
    userId,
  };
}

const credential = {
  backedUp: false,
  counter: 0,
  credentialId: "credential-one",
  deviceType: "singleDevice" as const,
  publicKey: new Uint8Array([1, 2, 3]),
  transports: ["internal"] as const,
};

async function insertCredential(credentialId = credential.credentialId) {
  await database.insert(passkeyCredentials).values({
    ...credential,
    credentialId,
    id: createUuidV7(),
    publicKey: Buffer.from(credential.publicKey),
    transports: [...credential.transports],
    userId,
  });
}

function replacementSession(digit: string) {
  return {
    absoluteExpiresAt: new Date(now.getTime() + 60_000),
    authenticatedAt: now,
    idleExpiresAt: new Date(now.getTime() + 30_000),
    tokenHash: digit.repeat(64),
  };
}

function activeSessionContext() {
  return {
    correlationId: createUuidV7(),
    minimumAuthenticatedAt: new Date(now.getTime() - 1_000),
    sessionId,
  };
}

describe("Drizzle passkey repository", () => {
  it("allows one concurrent link, consumes once, and rotates sessions", async () => {
    const issued = challenge();
    await repository.issueChallenge(issued);
    const stored = await repository.findChallenge(issued.challengeId);
    expect(stored).toEqual(issued);
    const results = await Promise.all([
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential,
        now,
        replacementSession: replacementSession("3"),
      }),
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential,
        now,
        replacementSession: replacementSession("4"),
      }),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "linked",
      "replayed",
    ]);
    expect(await repository.listCredentialIds(userId)).toEqual([
      "credential-one",
    ]);
    const sessions = await database.select().from(authSessions);
    expect(sessions.filter(({ revokedAt }) => revokedAt === null)).toHaveLength(
      1,
    );
    const events = await database.select().from(authSecurityEvents);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "passkey-linked",
      actorUserId: userId,
      sessionId,
    });
    expect(events[0]?.credentialFingerprint).not.toContain("credential-one");
  });

  it("returns a generic conflict when another user owns the credential", async () => {
    const issued = challenge();
    await repository.issueChallenge(issued);
    const otherUserId = createUuidV7();
    await database.insert(authUsers).values({
      email: `${otherUserId}@wallet.invalid`,
      id: otherUserId,
      name: "Other",
    });
    await database.insert(passkeyCredentials).values({
      ...credential,
      id: createUuidV7(),
      publicKey: Buffer.from(credential.publicKey),
      transports: [...credential.transports],
      userId: otherUserId,
    });
    await expect(
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential,
        now,
        replacementSession: replacementSession("3"),
      }),
    ).resolves.toEqual({ kind: "conflict" });
    expect(
      (await repository.findChallenge(issued.challengeId))?.consumedAt,
    ).toEqual(now);
  });

  it.each([
    ["challengeHash", "3".repeat(64)],
    ["origin", "https://wrong.invalid"],
    ["relyingPartyId", "wrong.invalid"],
    ["sessionId", createUuidV7()],
    ["userId", createUuidV7()],
    ["issuedAt", new Date(now.getTime() - 1)],
    ["expiresAt", now],
  ] as const)(
    "rejects a challenge whose %s no longer matches",
    async (field, value) => {
      const issued = challenge();
      await repository.issueChallenge(issued);
      await expect(
        repository.completeLink({
          ...activeSessionContext(),
          challenge: { ...issued, [field]: value },
          credential,
          now,
          replacementSession: replacementSession("3"),
        }),
      ).resolves.toEqual({ kind: "invalid" });
      expect(await repository.listCredentialIds(userId)).toEqual([]);
    },
  );

  it("treats a missing challenge and another user's credential as unavailable", async () => {
    await expect(repository.findChallenge(createUuidV7())).resolves.toBeNull();
    await expect(
      repository.completeLink({
        ...activeSessionContext(),
        challenge: challenge(),
        credential,
        now,
        replacementSession: replacementSession("3"),
      }),
    ).resolves.toEqual({ kind: "replayed" });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: "missing",
        now,
        replacementSession: replacementSession("4"),
        userId,
      }),
    ).resolves.toEqual({ kind: "missing" });
  });

  it("protects the final method and unlinks when a wallet remains", async () => {
    await insertCredential();
    await insertCredential("credential-two");
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("4"),
        userId,
      }),
    ).resolves.toEqual({ kind: "final-method" });
    await database.insert(walletIdentities).values({
      address: "tb1qexample",
      id: createUuidV7(),
      network: "signet",
      scriptIdentity: "0014deadbeef",
      userId,
      walletAdapter: "test",
    });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("5"),
        userId,
      }),
    ).resolves.toEqual({ kind: "unlinked" });
    expect(await repository.listCredentialIds(userId)).toEqual([
      "credential-two",
    ]);
    expect(await database.select().from(authSecurityEvents)).toEqual([
      expect.objectContaining({ action: "passkey-unlinked", sessionId }),
    ]);
  });

  it("rejects future-authenticated or revoked bound sessions", async () => {
    const issued = challenge();
    await repository.issueChallenge(issued);
    await insertCredential();
    await database.update(authSessions).set({
      authenticatedAt: new Date(now.getTime() + 1),
    });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("7"),
        userId,
      }),
    ).resolves.toEqual({ kind: "missing" });
    await database
      .update(authSessions)
      .set({ authenticatedAt: now, revokedAt: now });
    await expect(
      repository.completeLink({
        ...activeSessionContext(),
        challenge: issued,
        credential: { ...credential, credentialId: "credential-two" },
        now,
        replacementSession: replacementSession("6"),
      }),
    ).resolves.toEqual({ kind: "invalid" });
    await expect(
      repository.unlink({
        ...activeSessionContext(),
        credentialId: credential.credentialId,
        now,
        replacementSession: replacementSession("8"),
        userId,
      }),
    ).resolves.toEqual({ kind: "missing" });
  });
});
