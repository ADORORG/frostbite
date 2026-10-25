import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  authUsers,
  contactCodes,
  contactIdentities,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "../src/index.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const at = new Date("2026-10-25T12:00:00.000Z");
const later = new Date("2026-10-25T12:10:00.000Z");

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(contactCodes);
  await database.delete(contactIdentities);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

async function aUser() {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@contact.invalid`, id, name: "Email user" });
  return id;
}
const identity = (
  userId: string,
  value = "ada@example.com",
  kind = "email",
) => ({
  id: randomUUID(),
  kind,
  userId,
  value,
  verifiedAt: at,
});
const code = (overrides: Partial<typeof contactCodes.$inferInsert> = {}) => ({
  codeHash: "a".repeat(64),
  destination: "ada@example.com",
  expiresAt: later,
  id: randomUUID(),
  issuedAt: at,
  kind: "email",
  salt: "salt",
  ...overrides,
});

describe("contact identities in the database", () => {
  it("lets one address belong to one account only", async () => {
    const first = await aUser();
    const second = await aUser();
    await database.insert(contactIdentities).values(identity(first));
    await expect(
      database.insert(contactIdentities).values(identity(second)),
    ).rejects.toThrow();
    await expect(
      database
        .insert(contactIdentities)
        .values(identity(second, "ada@example.com", "phone")),
    ).resolves.toBeDefined();
  });

  it("refuses a kind that is not a method name and a blank value", async () => {
    const user = await aUser();
    for (const bad of [
      identity(user, "x@example.com", "Email"),
      identity(user, "x@example.com", "9mail"),
      identity(user, "   "),
    ])
      await expect(
        database.insert(contactIdentities).values(bad),
      ).rejects.toThrow();
  });

  it("goes with the account that held it", async () => {
    const user = await aUser();
    await database.insert(contactIdentities).values(identity(user));
    await database.delete(authUsers);
    expect(await database.select().from(contactIdentities)).toEqual([]);
  });
});

describe("contact codes in the database", () => {
  it("refuses a hash that is not a SHA-256, an empty salt, a negative try count and an expiry that is not after the issue", async () => {
    for (const bad of [
      code({ codeHash: "short" }),
      code({ codeHash: "A".repeat(64) }),
      code({ salt: "" }),
      code({ attempts: -1 }),
      code({ expiresAt: at }),
      code({ expiresAt: new Date(at.getTime() - 1) }),
    ])
      await expect(database.insert(contactCodes).values(bad)).rejects.toThrow();
    await expect(
      database.insert(contactCodes).values(code()),
    ).resolves.toBeDefined();
  });

  it("ties a code to an account exactly when it is a link code", async () => {
    const user = await aUser();
    for (const bad of [
      code({ purpose: "link" }),
      code({ purpose: "sign-in", userId: user }),
      code({ purpose: "other" }),
    ])
      await expect(database.insert(contactCodes).values(bad)).rejects.toThrow();
    await expect(
      database
        .insert(contactCodes)
        .values(code({ purpose: "link", userId: user })),
    ).resolves.toBeDefined();
  });

  it("goes with the account a link code was sent to", async () => {
    const user = await aUser();
    await database
      .insert(contactCodes)
      .values(code({ purpose: "link", userId: user }));
    await database.delete(authUsers);
    expect(await database.select().from(contactCodes)).toEqual([]);
  });
});
