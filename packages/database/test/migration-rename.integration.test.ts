import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "../src/index.ts";
import { applyMigrations } from "../src/migrations/apply.ts";
import { folderUpTo, removeFolders } from "./support/migration-folders.ts";
import {
  createScratchDatabase,
  dropScratchDatabase,
} from "./support/scratch-database.ts";

// The last migration made while the schema was still called "ador" (a database from before the rename stops here), and the rename itself.
// The test applies the rename and no migration after it, so later migrations that add tables do not change what it compares.
const lastBeforeRename = "20261027171854_claim_collectible";
const renameMigration = "20261105165948_rename_schema_frostbite";
const oldSchema = "ador";
const newSchema = "frostbite";

const environment = parseDatabaseEnvironment(process.env);
const admin = createDatabasePool(environment);
const databaseName = "migration_rename_test";
const scratch = new URL(environment.DATABASE_URL);
scratch.pathname = `/${databaseName}`;
const pool = createDatabasePool(environment, scratch.toString());
const staging: string[] = [];

const tablesIn = async (schema: string) =>
  (
    await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = $1 order by table_name`,
      [schema],
    )
  ).rows.map(({ table_name }) => table_name);

// Every place Postgres keeps SQL text that a schema rename does not rewrite: function bodies, view definitions, column defaults and
// CHECK constraints. Each row is one that still names the old schema.
async function textNaming(schema: string): Promise<string[]> {
  const { rows } = await pool.query<{ what: string }>(
    `select 'function ' || p.proname as what from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = $2 and p.prosrc ~* ('"?' || $1 || '"?\\.')
     union all select 'view ' || viewname from pg_views where schemaname = $2 and definition ~* ('"?' || $1 || '"?\\.')
     union all select 'default ' || c.relname || '.' || a.attname
       from pg_attrdef d join pg_class c on c.oid = d.adrelid join pg_attribute a on a.attrelid = c.oid and a.attnum = d.adnum
       join pg_namespace n on n.oid = c.relnamespace where n.nspname = $2 and pg_get_expr(d.adbin, d.adrelid) ~* ('"?' || $1 || '"?\\.')
     union all select 'constraint ' || con.conname from pg_constraint con join pg_namespace n on n.oid = con.connamespace
       where n.nspname = $2 and pg_get_constraintdef(con.oid) ~* ('"?' || $1 || '"?\\.')`,
    [oldSchema, schema],
  );
  return rows.map(({ what }) => what);
}

beforeAll(async () => {
  await createScratchDatabase(admin, databaseName);
});

afterAll(async () => {
  await pool.end();
  await dropScratchDatabase(admin, databaseName);
  await admin.end();
  await removeFolders(staging);
});

describe("the migration that renames the schema", () => {
  it("moves every table to the new schema and leaves no SQL text that names the old one", async () => {
    const database = createDatabaseClient(pool);
    await applyMigrations(
      database,
      await folderUpTo(lastBeforeRename, staging),
    );
    const before = await tablesIn(oldSchema);
    expect(before).toContain("collection_submissions");
    expect(await tablesIn(newSchema)).toEqual([]);

    await applyMigrations(database, await folderUpTo(renameMigration, staging));

    expect(await tablesIn(newSchema)).toEqual(before);
    expect(await tablesIn(oldSchema)).toEqual([]);
    expect(await textNaming(newSchema)).toEqual([]);
  });
});
