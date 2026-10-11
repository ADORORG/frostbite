import {
  assets,
  authUsers,
  collectionItems,
  collectionReviewEvents,
  collectionSubmissions,
  collections,
  createDatabaseClient,
  createDatabasePool,
  creatorApplications,
  parseDatabaseEnvironment,
  platformRoleAssignments,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import type { UploadPurpose } from "@ador/shared/uploads";
import {
  seedCreatorUser,
  seedPlatformUser,
  seedUploadedAsset,
  setCreatorApplicationState,
  type CreatorApplicationState,
  type SeededAssetState,
} from "@ador/test-kit/creator-database";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { now } from "./fixtures.ts";
import { createDrizzleCollectionRepository } from "../../src/adapters/drizzle-repository.ts";
import { createDrizzleApprovedVersionReader } from "../../src/adapters/approved-version.ts";
import { createDrizzleSubmissionRepository } from "../../src/adapters/drizzle-submissions.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleCollectionRepository(database);
export const submissions = createDrizzleSubmissionRepository(database);

// Registers the suite lifecycle: real migrations, then an empty slate for every test.
export function useCollectionDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  const clear = async () => {
    // Submissions and their events are append-only (row triggers refuse deletes), so a test resets them
    // with TRUNCATE, which is how a test database is emptied and not an operation the application has.
    await database.execute(
      sql`truncate table ${collectionReviewEvents}, ${collectionSubmissions}`,
    );
    await database.delete(collectionItems);
    await database.delete(collections);
    await database.delete(assets);
    await database.delete(uploadIntents);
    await database.delete(creatorApplications);
    await database.delete(platformRoleAssignments);
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

export const seedReviewer = (
  role?: Parameters<typeof seedPlatformUser>[1],
  status?: Parameters<typeof seedPlatformUser>[2],
) => seedPlatformUser(database, role, status);

export const seedAsset = (
  userId: string,
  purpose: UploadPurpose,
  state?: SeededAssetState,
  fileName?: string,
) => seedUploadedAsset(database, { fileName, now, purpose, state, userId });

export const approvedVersions = createDrizzleApprovedVersionReader(database);
