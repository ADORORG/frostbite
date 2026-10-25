// The database, repository and clock the contact-code tests share.
import {
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

// Migrates once, empties the contact and account tables before each test, and closes the pool at the end.
export function useContactWorld() {
  beforeAll(async () => runMigrations(environment));
  afterAll(async () => pool.end());
  beforeEach(async () => {
    await database.delete(contactCodes);
    await database.delete(contactIdentities);
    await database.delete(authSessions);
    await database.delete(authUsers);
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
    salt: "salt",
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
