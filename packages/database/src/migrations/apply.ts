import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import type { DatabaseClient } from "../connection/client.ts";

export const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../migrations",
);

// Drizzle runs every pending migration in one transaction, and PostgreSQL refuses to use an enum value in the transaction that added
// it ("unsafe use of new value"). A database made earlier, with a later migration adding a value and an earlier one using it, could
// then not be upgraded, though a fresh one could (its enum is created in the same transaction). So each migration is applied by
// itself, in the order drizzle sorts them: the folder it is given holds the migrations applied so far plus the next one, and drizzle
// runs only what the database lacks. Each commits before the next starts, and each is recorded as drizzle records it.
export async function applyMigrations(
  database: DatabaseClient,
  directory = migrationsDirectory,
): Promise<void> {
  const names = (await readdir(directory))
    .filter((name) => existsSync(join(directory, name, "migration.sql")))
    .sort((a, b) => a.localeCompare(b));
  const staging = await mkdtemp(join(tmpdir(), "migrations-"));
  try {
    for (const name of names) {
      await symlink(join(directory, name), join(staging, name), "dir");
      await migrate(database, { migrationsFolder: staging });
    }
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
}
