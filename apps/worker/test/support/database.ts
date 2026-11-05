import {
  assetDerivatives,
  assets,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  outboxEvents,
  parseDatabaseEnvironment,
  uploadIntents,
} from "@frostbite/database";

// One reading of the real clock for every timestamp of the scenario. The database enforces ordering
// between them (cleanup after expiry), and the pipeline compares them with the real time, so a fixed
// calendar date would eventually fall out of order.
export const now = new Date();

export const database = createDatabaseClient(
  createDatabasePool(parseDatabaseEnvironment(process.env)),
);

export async function clearDatabase(): Promise<void> {
  await database.delete(assetDerivatives);
  await database.delete(assets);
  await database.delete(outboxEvents);
  await database.delete(uploadIntents);
  await database.delete(authUsers);
}
