import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  type DatabaseClient,
} from "@ador/database/connection";

let client: DatabaseClient | undefined;

// The web process's one database client, made on first use from the validated environment, so everything in
// the process (sessions, readiness) shares one pool.
export function getDatabase(): DatabaseClient {
  client ??= createDatabaseClient(
    createDatabasePool(parseDatabaseEnvironment(process.env)),
  );
  return client;
}
