import { readdir } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "../src/index.ts";
import {
  applyMigrations,
  migrationsDirectory,
} from "../src/migrations/apply.ts";
import { folderUpTo, removeFolders } from "./support/migration-folders.ts";
import {
  createScratchDatabase,
  dropScratchDatabase,
} from "./support/scratch-database.ts";

const environment = parseDatabaseEnvironment(process.env);
const admin = createDatabasePool(environment);
const databaseName = "migration_upgrade_test";
const scratch = new URL(environment.DATABASE_URL);
scratch.pathname = `/${databaseName}`;
const pool = createDatabasePool(environment, scratch.toString());
const staging: string[] = [];

beforeAll(async () => {
  await createScratchDatabase(admin, databaseName);
});

afterAll(async () => {
  await pool.end();
  await dropScratchDatabase(admin, databaseName);
  await admin.end();
  await removeFolders(staging);
});

describe("upgrading a database made by an earlier release", () => {
  // `left_glorian` adds the upload state "abandoned" and uses it in an index and a CHECK; a database that already had the enum,
  // as every one made before it did, failed with "unsafe use of new value" when all pending migrations ran in one transaction.
  it("applies later migrations that use an enum value an earlier one added", async () => {
    const database = createDatabaseClient(pool);
    await applyMigrations(
      database,
      await folderUpTo("20261004173305_massive_living_mummy", staging),
    );
    const before = await pool.query<{ enumlabel: string }>(
      `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'upload_intent_state'`,
    );
    expect(before.rows.map(({ enumlabel }) => enumlabel)).not.toContain(
      "abandoned",
    );

    await applyMigrations(database);

    const after = await pool.query<{ enumlabel: string }>(
      `select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'upload_intent_state'`,
    );
    expect(after.rows.map(({ enumlabel }) => enumlabel)).toContain("abandoned");
    const applied = await pool.query<{ name: string }>(
      `select name from drizzle.__drizzle_migrations order by id`,
    );
    const onDisk = (await readdir(migrationsDirectory)).sort((a, b) =>
      a.localeCompare(b),
    );
    expect(applied.rows.map(({ name }) => name)).toEqual(onDisk);
  });

  it("does nothing the second time", async () => {
    const database = createDatabaseClient(pool);
    const count = async () =>
      (await pool.query(`select 1 from drizzle.__drizzle_migrations`)).rowCount;
    const first = await count();
    await applyMigrations(database);
    expect(await count()).toBe(first);
  });
});
