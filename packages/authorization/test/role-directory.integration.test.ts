import { platformRoleAssignments, runMigrations } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleRoleDirectory } from "../src/adapters/drizzle-role-directory.ts";
import {
  admin,
  clean,
  database,
  environment,
  person,
  pool,
  rules,
} from "./support/role-world.ts";

// Naming and finding are the sign-in methods' business and are given: here, names from a table and finds by exact text.
const names = new Map<string, string>();
const finds = new Map<string, string[]>();
const directory = createDrizzleRoleDirectory(database, {
  ...rules,
  label: async (_context, userId) => names.get(userId) ?? null,
  lookup: async (_context, text) => finds.get(text) ?? [],
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  names.clear();
  finds.clear();
  await clean();
});
afterAll(async () => {
  await clean();
  await pool.end();
});

const give = (
  userId: string,
  role: "admin" | "reviewer" | "staff",
  status: "active" | "suspended" = "active",
) =>
  database
    .insert(platformRoleAssignments)
    .values({ id: createUuidV7(), role, status, userId });

describe("who holds roles", () => {
  it("lists each account that has held a role once, with every role and whether it works", async () => {
    const withWallet = await person(true);
    const withoutWallet = await person(false);
    await give(withWallet, "staff");
    await give(withWallet, "reviewer", "suspended");
    await give(withoutWallet, "admin");
    names.set(withWallet, "ada@example.com");
    const holders = await directory.holders();
    expect(holders).toHaveLength(2);
    const ada = holders.find(({ userId }) => userId === withWallet);
    expect(ada?.label).toBe("ada@example.com");
    expect(ada?.roles).toEqual([
      { effective: false, role: "reviewer", status: "suspended" },
      { effective: true, role: "staff", status: "active" },
    ]);
    // A role recorded for an account that lacks the wallet it needs is active but does not work; nameless accounts get a stable fallback.
    const other = holders.find(({ userId }) => userId === withoutWallet);
    expect(other?.roles).toEqual([
      { effective: false, role: "admin", status: "active" },
    ]);
    expect(other?.label).toBe(`Account ${withoutWallet.slice(0, 8)}`);
  });

  it("includes an account whose roles are all suspended, and nobody who never held one", async () => {
    const lapsed = await person(true);
    await person(true);
    await give(lapsed, "staff", "suspended");
    expect((await directory.holders()).map(({ userId }) => userId)).toEqual([
      lapsed,
    ]);
  });

  it("does not count a suspended role as working even when the account holds the wallet", async () => {
    const user = await person(true);
    await give(user, "staff", "suspended");
    expect((await directory.holders())[0]?.roles).toEqual([
      { effective: false, role: "staff", status: "suspended" },
    ]);
  });

  it("is empty when nobody holds a role", async () => {
    await person(true);
    expect(await directory.holders()).toEqual([]);
  });
});

describe("finding a person", () => {
  it("finds the accounts the sign-in methods name, with their roles, and an account with no role shows none", async () => {
    const holder = await admin(true);
    const plain = await person(false);
    finds.set("ada@example.com", [holder, plain]);
    const found = await directory.find("ada@example.com", 10);
    expect(found.map(({ userId }) => userId)).toEqual([holder, plain]);
    expect(found[0]?.roles).toEqual([
      { effective: true, role: "admin", status: "active" },
    ]);
    expect(found[1]?.roles).toEqual([]);
  });

  it("finds an account by its id as typed, and nothing for an id that is nobody's", async () => {
    const user = await person(true);
    expect(
      (await directory.find(user, 10)).map(({ userId }) => userId),
    ).toEqual([user]);
    expect(await directory.find(createUuidV7(), 10)).toEqual([]);
  });

  it("names each account once even if a method and the id both found it, and respects the limit", async () => {
    const first = await person(true);
    const second = await person(true);
    const third = await person(true);
    finds.set(first, [first, second, third]);
    expect(
      (await directory.find(first, 10)).map(({ userId }) => userId),
    ).toEqual([first, second, third]);
    expect(await directory.find(first, 2)).toHaveLength(2);
  });

  it("finds nobody for text nothing recognises", async () => {
    await person(true);
    expect(await directory.find("nobody@example.com", 10)).toEqual([]);
  });

  it("shows the state as the database has it after a role changes", async () => {
    const user = await admin(true);
    finds.set("x", [user]);
    await database
      .update(platformRoleAssignments)
      .set({ status: "suspended" })
      .where(eq(platformRoleAssignments.userId, user));
    expect((await directory.find("x", 10))[0]?.roles[0]).toEqual({
      effective: false,
      role: "admin",
      status: "suspended",
    });
  });
});
