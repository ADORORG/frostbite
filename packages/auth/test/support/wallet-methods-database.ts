import { randomUUID } from "node:crypto";

import {
  authSecurityEvents,
  authSessions,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  releasedWallets,
  runMigrations,
  walletChallenges,
  walletIdentities,
} from "@ador/database";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleWalletAuthRepository } from "../../src/adapters/drizzle-wallet-auth-repository.ts";
import { createWalletAuthService } from "../../src/application/service.ts";
import { strictBip322Verifier } from "../../src/bitcoin/verifier.ts";
import { sha256 } from "../../src/domain/crypto.ts";
import { createDrizzleWalletMethodsRepository } from "../../src/wallets/drizzle-repository.ts";
import { methodRegistry } from "./registry.ts";
import { createWalletMethodsService } from "../../src/wallets/service.ts";
import {
  signWalletMessage,
  validChallengeInput,
  walletAuthPolicy,
} from "./fixtures.ts";

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const clock = { now: new Date("2026-10-13T12:00:00.000Z") };
export const holdMs = 86_400_000;
export const auth = createWalletAuthService({
  clock: () => clock.now,
  policy: walletAuthPolicy,
  repository: createDrizzleWalletAuthRepository(database),
  verifier: strictBip322Verifier,
});
export const methods = createWalletMethodsService({
  clock: () => clock.now,
  policy: {
    recentAuthenticationWindowMs: 600_000,
    releaseHoldMs: holdMs,
    sessionAbsoluteLifetimeMs: 86_400_000,
    sessionIdleLifetimeMs: 3_600_000,
  },
  repository: createDrizzleWalletMethodsRepository(
    database,
    methodRegistry.list,
  ),
});

// Security events keep their session and user (restrict), so they go first; other files clean up without them.
async function clearAccounts() {
  await database.delete(authSecurityEvents);
  await database.delete(releasedWallets);
  await database.delete(authSessions);
  await database.delete(walletChallenges);
  await database.delete(walletIdentities);
  await database.delete(authUsers);
}

// Migrates once, empties the account tables before each test and at the end, and closes the pool.
export function registerWalletMethodsDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  beforeEach(async () => {
    await clearAccounts();
    clock.now = new Date("2026-10-13T12:00:00.000Z");
  });
  afterAll(async () => {
    await clearAccounts();
    await pool.end();
  });
}

// A wallet the test key does not control, put straight on an account: enough to have a second way in.
export async function addWallet(userId: UuidV7): Promise<UuidV7> {
  const id = createUuidV7();
  await database.insert(walletIdentities).values({
    address: `tb1q${randomUUID().replaceAll("-", "").slice(0, 30)}`,
    id,
    network: "signet",
    scriptIdentity: randomUUID().replaceAll("-", ""),
    userId,
    walletAdapter: "test",
  });
  return id;
}

export async function signIn(): Promise<{
  sessionId: UuidV7;
  token: string;
  userId: UuidV7;
}> {
  const challenge = await auth.issue(validChallengeInput());
  if (challenge === null) throw new Error("challenge refused");
  const result = await auth.verify({
    expectedAction: "sign-in",
    challengeId: challenge.challengeId,
    signature: signWalletMessage(challenge.message),
  });
  if (!result.ok) throw new Error(`sign-in refused: ${result.code}`);
  return {
    ...(await sessionOf(result.sessionToken)),
    token: result.sessionToken,
    userId: result.userId,
  };
}

export async function sessionOf(token: string) {
  const [row] = await database
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, sha256(token)));
  if (row === undefined) throw new Error("no such session");
  return {
    sessionId: createUuidV7Of(row.id),
    userId: createUuidV7Of(row.userId),
  };
}
export const createUuidV7Of = (value: string) => value as UuidV7;

export async function activeSession(userId: UuidV7, token: string) {
  const [row] = await database
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, sha256(token)));
  return {
    absoluteExpiresAt: row?.absoluteExpiresAt ?? clock.now,
    authenticatedAt: row?.authenticatedAt ?? clock.now,
    idleExpiresAt: row?.idleExpiresAt ?? clock.now,
    sessionId: createUuidV7Of(row?.id ?? ""),
    userId,
  };
}

export const walletsOf = async (userId: UuidV7) =>
  database
    .select()
    .from(walletIdentities)
    .where(eq(walletIdentities.userId, userId));
