import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  runMigrations,
} from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { expectToWait, holdTransaction } from "@ador/test-kit/race";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { holdsActivePlatformRole } from "../src/adapters/role-guard.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(platformRoleAssignments);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

async function userWith(
  role: "reviewer" | "staff",
  status: "active" | "suspended" = "active",
) {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@wallet.invalid`, id, name: "Person" });
  await database
    .insert(platformRoleAssignments)
    .values({ id: createUuidV7(), role, status, userId: id });
  return id;
}

const check = (userId: string, roles: readonly ("reviewer" | "staff")[]) =>
  database.transaction((transaction) =>
    holdsActivePlatformRole(transaction, userId, roles),
  );

describe("platform role guard", () => {
  it("is true only for an active assignment of one of the named roles", async () => {
    const reviewer = await userWith("reviewer");
    expect(await check(reviewer, ["reviewer"])).toBe(true);
    expect(await check(reviewer, ["staff", "reviewer"])).toBe(true);
    expect(await check(reviewer, ["staff"])).toBe(false);
  });

  it("is false for a suspended assignment, an unknown user, and no roles", async () => {
    const suspended = await userWith("reviewer", "suspended");
    expect(await check(suspended, ["reviewer"])).toBe(false);
    expect(await check(createUuidV7(), ["reviewer"])).toBe(false);
    const reviewer = await userWith("reviewer");
    expect(await check(reviewer, [])).toBe(false);
  });

  it("makes a role withdrawal wait for the decision it authorizes", async () => {
    const reviewer = await userWith("reviewer");
    const holder = await holdTransaction(database, async (transaction) => {
      expect(
        await holdsActivePlatformRole(transaction, reviewer, ["reviewer"]),
      ).toBe(true);
    });
    await expectToWait(holder, () =>
      database
        .update(platformRoleAssignments)
        .set({ status: "suspended" })
        .where(eq(platformRoleAssignments.userId, reviewer)),
    );
    expect(await check(reviewer, ["reviewer"])).toBe(false);
  });
});
