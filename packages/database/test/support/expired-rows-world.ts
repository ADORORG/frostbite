import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach } from "vitest";

import {
  authSessions,
  authUsers,
  contactCodes,
  createDatabaseClient,
  createDatabasePool,
  outboxEvents,
  parseDatabaseEnvironment,
  passkeyChallenges,
  passkeySignInChallenges,
  runMigrations,
  walletChallenges,
  type ExpiredRowLimits,
} from "../../src/index.ts";

// The database, the clock and the rows the expired-row tests share. Each row lives from `issued` to `expires`, both given as how long
// before the test's `now`.
export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const now = new Date("2026-11-04T12:00:00.000Z");
export const minute = 60_000;
export const hour = 60 * minute;
export const day = 24 * hour;
export const limits: ExpiredRowLimits = {
  batchSize: 500,
  contactCodeRetentionMs: hour,
  deliveredOutboxRetentionMs: 7 * day,
};
export const ago = (ms: number) => new Date(now.getTime() - ms);

// Registers the hooks every file needs: migrate once, empty the tables before each test, close the pool after.
export function useExpiredRowsWorld() {
  beforeAll(async () => runMigrations(environment));
  beforeEach(async () => {
    for (const table of [
      contactCodes,
      walletChallenges,
      passkeyChallenges,
      passkeySignInChallenges,
      outboxEvents,
      authSessions,
      authUsers,
    ])
      await database.delete(table);
  });
  afterAll(async () => pool.end());
}

export async function aUser() {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@contact.invalid`, id, name: "Test" });
  return id;
}
export async function aSession(userId: string) {
  const id = randomUUID();
  await database.insert(authSessions).values({
    absoluteExpiresAt: new Date(now.getTime() + day),
    authenticatedAt: now,
    id,
    idleExpiresAt: new Date(now.getTime() + hour),
    tokenHash: "a".repeat(64),
    userId,
  });
  return id;
}
// Each row lives from `issued` to `expires`, both as how long before now.
export const wallet = (issuedAgo: number, expiresAgo: number) => ({
  action: "sign-in" as const,
  address: "tb1qexample",
  attempts: 0,
  domain: "example.test",
  expiresAt: ago(expiresAgo),
  id: randomUUID(),
  issuedAt: ago(issuedAgo),
  messageHash: "b".repeat(64),
  network: "signet",
  nonce: randomUUID(),
  origin: "https://example.test",
  requestId: randomUUID(),
  schemaVersion: 1,
  scriptIdentity: "script",
  signatureScheme: "bip322-simple",
  uri: "https://example.test",
  walletAdapter: "unisat",
});
export const code = (issuedAgo: number, expiresAgo: number) => ({
  codeHash: "c".repeat(64),
  destination: `${randomUUID().slice(0, 8)}@example.test`,
  expiresAt: ago(expiresAgo),
  id: randomUUID(),
  issuedAt: ago(issuedAgo),
  kind: "email",
  salt: "salt",
});
export const outbox = (
  status: "delivered" | "failed" | "pending",
  deliveredAgo: number | null,
) => ({
  availableAt: ago(30 * day),
  correlationId: randomUUID(),
  deliveredAt: deliveredAgo === null ? null : ago(deliveredAgo),
  eventId: randomUUID(),
  eventName: "platform.fixture.created.v1",
  failureReason: status === "failed" ? "gave up" : null,
  occurredAt: ago(30 * day),
  payload: {},
  schemaVersion: 1,
  status,
});
export const left = async (
  table: typeof walletChallenges | typeof contactCodes,
) => (await database.select({ id: table.id }).from(table)).length;
