import { mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { migrationsDirectory } from "../../src/migrations/apply.ts";

// A folder holding only the migrations up to and including `lastApplied`: a database as an earlier release left it.
export async function folderUpTo(
  lastApplied: string,
  staging: string[],
): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "migrations-upto-"));
  staging.push(folder);
  for (const name of (await readdir(migrationsDirectory)).sort())
    if (name <= lastApplied)
      await symlink(join(migrationsDirectory, name), join(folder, name), "dir");
  return folder;
}

export async function removeFolders(staging: readonly string[]): Promise<void> {
  await Promise.all(
    staging.map((folder) => rm(folder, { force: true, recursive: true })),
  );
}
