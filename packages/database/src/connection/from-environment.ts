import { createDatabaseClient, type DatabaseClient } from "./client.ts";
import { parseDatabaseEnvironment } from "./config.ts";
import { createDatabasePool } from "./pool.ts";

// A client over a new pool from validated configuration. It fails fast on a missing or invalid
// setting, and connects lazily, on the first query.
export function createDatabaseFromEnvironment(
  source: NodeJS.ProcessEnv,
): DatabaseClient {
  return createDatabaseClient(
    createDatabasePool(parseDatabaseEnvironment(source)),
  );
}
