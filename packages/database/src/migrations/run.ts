import type { DatabaseEnvironment } from "../connection/config.ts";
import { resolveMigrationUrl } from "../connection/config.ts";
import { createDatabaseClient } from "../connection/client.ts";
import { createDatabasePool, toPoolConfig } from "../connection/pool.ts";
import { applyMigrations } from "./apply.ts";
import { withMigrationLock } from "./lock.ts";

// Applies the pending migrations, one process at a time: a process that starts while another migrates waits, then finds nothing left.
export async function runMigrations(
  environment: DatabaseEnvironment,
): Promise<void> {
  const url = resolveMigrationUrl(environment);
  await withMigrationLock(toPoolConfig(environment, url), async () => {
    const pool = createDatabasePool(environment, url);
    try {
      await applyMigrations(createDatabaseClient(pool));
    } finally {
      await pool.end();
    }
  });
}
