import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";

let sharedDatabase: ReturnType<typeof createDatabaseClient> | undefined;

// One connection pool for everything this feature does, made when something first needs it.
export function database() {
  sharedDatabase ??= createDatabaseClient(
    createDatabasePool(parseDatabaseEnvironment(process.env)),
  );
  return sharedDatabase;
}
