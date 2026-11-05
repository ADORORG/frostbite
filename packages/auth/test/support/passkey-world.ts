// The database, repository and fixtures the passkey repository tests share.
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
} from "@frostbite/database";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzlePasskeyRepository } from "../../src/passkeys/drizzle-repository.ts";
import { listMethods } from "./registry.ts";

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzlePasskeyRepository(database, listMethods);
export const now = new Date("2026-09-10T12:00:00.000Z");
// Live bindings: they change for every test, and the files that import them see the current values.
export let userId = createUuidV7();
export let sessionId = createUuidV7();

// Registers the hooks that give each test an empty database with one user and one session. Call it once at the top of a test file.
export function useWorld() {
  beforeAll(async () => runMigrations(environment));
  afterAll(async () => pool.end());
  beforeEach(resetWorld);
}

async function resetWorld() {
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
}

export function challenge() {
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

export const credential = {
  backedUp: false,
  counter: 0,
  credentialId: "credential-one",
  deviceType: "singleDevice" as const,
  publicKey: new Uint8Array([1, 2, 3]),
  transports: ["internal"] as const,
};

export async function insertCredential(credentialId = credential.credentialId) {
  await database.insert(passkeyCredentials).values({
    ...credential,
    credentialId,
    id: createUuidV7(),
    publicKey: Buffer.from(credential.publicKey),
    transports: [...credential.transports],
    userId,
  });
}

export function replacementSession(digit: string) {
  return {
    absoluteExpiresAt: new Date(now.getTime() + 60_000),
    authenticatedAt: now,
    idleExpiresAt: new Date(now.getTime() + 30_000),
    tokenHash: digit.repeat(64),
  };
}

export function activeSessionContext() {
  return {
    correlationId: createUuidV7(),
    minimumAuthenticatedAt: new Date(now.getTime() - 1_000),
    sessionId,
  };
}
