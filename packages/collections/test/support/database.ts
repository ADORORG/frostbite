import {
  assets,
  authUsers,
  collectionItems,
  collections,
  createDatabaseClient,
  createDatabasePool,
  creatorApplications,
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import type { UploadPurpose } from "@ador/shared/uploads";
import {
  seedCreatorUser,
  seedUploadedAsset,
  setCreatorApplicationState,
  type CreatorApplicationState,
  type SeededAssetState,
} from "@ador/test-kit/creator-database";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { now } from "./fixtures.ts";
import { createDrizzleCollectionRepository } from "../../src/adapters/drizzle-repository.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleCollectionRepository(database);

// Registers the suite lifecycle: real migrations, then an empty slate for every test.
export function useCollectionDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  const clear = async () => {
    await database.delete(collectionItems);
    await database.delete(collections);
    await database.delete(assets);
    await database.delete(uploadIntents);
    await database.delete(creatorApplications);
    await database.delete(authUsers);
  };
  beforeEach(clear);
  afterAll(async () => {
    await clear();
    await pool.end();
  });
}

export const seedUser = (state?: CreatorApplicationState | null) =>
  seedCreatorUser(database, state);

export const setApplicationState = (
  userId: string,
  state: CreatorApplicationState,
) => setCreatorApplicationState(database, userId, state);

export const seedAsset = (
  userId: string,
  purpose: UploadPurpose,
  state?: SeededAssetState,
) => seedUploadedAsset(database, { now, purpose, state, userId });
