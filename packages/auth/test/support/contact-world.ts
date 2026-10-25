// The database, repository and clock the contact-code tests share.
import {
  authSecurityEvents,
  authSessions,
  authUsers,
  contactCodes,
  contactIdentities,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleContactCodeRepository } from "../../src/contacts/drizzle-repository.ts";
import { sha256 } from "../../src/domain/crypto.ts";
import type { IssueCodeInput } from "../../src/contacts/repository.ts";

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleContactCodeRepository(database);
export const start = new Date("2026-10-25T12:00:00.000Z");
// The service's clock, which a test moves to pass a cooldown or expire a code.
export const clock = { now: start };

export const limits = {
  cooldownMs: 60_000,
  maximumPerWindow: 3,
  windowMs: 3_600_000,
};
export const lifetimeMs = 600_000;
// Every session needs a token hash of its own.
export const sessionMaterial = () => ({
  absoluteExpiresAt: new Date(start.getTime() + 3_600_000),
  authenticatedAt: start,
  idleExpiresAt: new Date(start.getTime() + 600_000),
  tokenHash: sha256(createUuidV7()),
});

async function empty() {
  await database.delete(contactCodes);
  await database.delete(contactIdentities);
  // Audit rows hold their session and user, so they go first; another test file's cleanup could not delete those sessions otherwise.
  await database.delete(authSecurityEvents);
  await database.delete(authSessions);
  await database.delete(authUsers);
}

// Migrates once, empties the contact and account tables before each test and again when the file is done (so the next file starts from
// what it expects), and closes the pool at the end.
export function useContactWorld() {
  beforeAll(async () => runMigrations(environment));
  afterAll(async () => {
    await empty();
    await pool.end();
  });
  beforeEach(async () => {
    await empty();
    clock.now = start;
  });
}

export function issueInput(
  overrides: Partial<IssueCodeInput> = {},
): IssueCodeInput {
  const issuedAt = overrides.issuedAt ?? clock.now;
  return {
    codeHash: "a".repeat(64),
    destination: "ada@example.com",
    expiresAt: new Date(issuedAt.getTime() + lifetimeMs),
    id: createUuidV7(),
    issuedAt,
    kind: "email",
    limits,
    purpose: "sign-in",
    salt: "salt",
    userId: null,
    ...overrides,
  };
}

export function signInInput(
  codeId: string,
  overrides: { destination?: string; now?: Date } = {},
) {
  return {
    accountName: "Email user",
    codeId,
    destination: overrides.destination ?? "ada@example.com",
    kind: "email",
    now: overrides.now ?? clock.now,
    session: sessionMaterial(),
  };
}

// A signed-in account that holds one address: its user, its identity and a session authenticated at `authenticatedAt`.
export async function signedInAccount(
  input: {
    readonly address?: string;
    readonly authenticatedAt?: Date;
  } = {},
) {
  const userId = createUuidV7();
  const sessionId = createUuidV7();
  await database.insert(authUsers).values({
    email: `contact-${userId}@contact.invalid`,
    id: userId,
    name: "Email user",
  });
  if (input.address !== undefined)
    await database.insert(contactIdentities).values({
      createdAt: start,
      id: createUuidV7(),
      kind: "email",
      userId,
      value: input.address,
      verifiedAt: start,
    });
  await database.insert(authSessions).values({
    absoluteExpiresAt: new Date(start.getTime() + 7_200_000),
    authenticatedAt: input.authenticatedAt ?? start,
    id: sessionId,
    idleExpiresAt: new Date(start.getTime() + 3_600_000),
    tokenHash: sha256(createUuidV7()),
    userId,
  });
  return { sessionId, userId };
}

// Another live session for an account that already exists.
export async function signedInAccountSession(userId: string) {
  const sessionId = createUuidV7();
  await database.insert(authSessions).values({
    absoluteExpiresAt: new Date(start.getTime() + 7_200_000),
    authenticatedAt: start,
    id: sessionId,
    idleExpiresAt: new Date(start.getTime() + 3_600_000),
    tokenHash: sha256(createUuidV7()),
    userId,
  });
  return sessionId;
}
