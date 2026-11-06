import { Client, type ClientConfig } from "pg";

// The name the lock is taken on, turned into the 64-bit key PostgreSQL wants. One name, so every process that migrates this database
// (the web container at start, an operator's command) waits for the others instead of racing them.
export const migrationLockName = "frostbite.database.migrations";

// How long a process waits for another that is migrating. A migration holds the lock for as long as it runs, so this is longer than any
// migration should take; a holder that hangs is not waited on for ever.
export const migrationLockWaitMs = 600_000;

// Runs `work` while this process holds the migration lock. The lock belongs to a connection of its own (not the pool the migrations
// use), so it holds however small the pool is, and PostgreSQL releases it if that connection or the process dies.
export async function withMigrationLock<Result>(
  config: ClientConfig,
  work: () => Promise<Result>,
  waitMs = migrationLockWaitMs,
): Promise<Result> {
  const client = new Client({
    ...config,
    statement_timeout: waitMs,
  });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [
      migrationLockName,
    ]);
    return await work();
  } finally {
    // Closing the connection releases the lock, even when the unlock fails.
    await client.end();
  }
}
