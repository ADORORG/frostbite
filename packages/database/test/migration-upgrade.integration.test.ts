import { mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

// A database as an earlier release left it: only the migrations up to and including `lastApplied`.
async function folderUpTo(lastApplied: string): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "migrations-upto-"));
  staging.push(folder);
  for (const name of (await readdir(migrationsDirectory)).sort()) {
    if (name <= lastApplied) {
      await symlink(join(migrationsDirectory, name), join(folder, name), "dir");
    }
  }
  return folder;
}

beforeAll(async () => {
  await createScratchDatabase(admin, databaseName);
});

afterAll(async () => {
  await pool.end();
  await dropScratchDatabase(admin, databaseName);
  await admin.end();
  await Promise.all(
    staging.map((folder) => rm(folder, { force: true, recursive: true })),
  );
});

describe("upgrading a database made by an earlier release", () => {
  // `left_glorian` adds the upload state "abandoned" and uses it in an index and a CHECK; a database that already had the enum,
  // as every one made before it did, failed with "unsafe use of new value" when all pending migrations ran in one transaction.
  it("applies later migrations that use an enum value an earlier one added", async () => {
    const database = createDatabaseClient(pool);
    await applyMigrations(
      database,
      await folderUpTo("20261004173305_massive_living_mummy"),
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
