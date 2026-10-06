import {
  assets,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleAssetValidationRepository } from "../../src/adapters/drizzle-validation-repository.ts";
import type { AssetValidationOutcome } from "../../src/application/validation-repository.ts";
import { providerId, tinyPng } from "./images.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const repository = createDrizzleAssetValidationRepository(database);
export const now = new Date("2026-10-06T12:00:00.000Z");
export const png = tinyPng(7, 5);
export const sha = "a".repeat(64);

// Registers the suite lifecycle: real migrations, then an empty slate for every test.
export function useValidationDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  beforeEach(async () => {
    await database.delete(assets);
    await database.delete(uploadIntents);
    await database.delete(authUsers);
  });
  afterAll(async () => pool.end());
}

export async function seed(options: { readonly byteLength?: number } = {}) {
  const userId = createUuidV7();
  const intentId = createUuidV7();
  const assetId = createUuidV7();
  const objectKey = `drafts/${createUuidV7()}`;
  await database.insert(authUsers).values({
    email: `${userId}@example.test`,
    id: userId,
    name: "Uploader",
  });
  await database.insert(uploadIntents).values({
    byteLength: options.byteLength ?? png.length,
    cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
    contentType: "image/png",
    expiresAt: new Date(now.getTime() + 60_000),
    id: intentId,
    idempotencyKey: "upload-request-0001",
    objectKey,
    purpose: "collection-artwork",
    requestFingerprint: "b".repeat(64),
    retainUntil: new Date(now.getTime() + 2_592_000_000),
    state: "completed",
    storageProviderId: providerId,
    userId,
  });
  await database.insert(assets).values({
    id: assetId,
    objectKey,
    observedByteLength: png.length,
    observedContentType: "image/png",
    observedEntityTag: "completion-etag",
    observedLastModifiedAt: now,
    storageProviderId: providerId,
    uploadIntentId: intentId,
    userId,
  });
  return { assetId: uuidV7Schema.parse(assetId), objectKey };
}

export const validated: AssetValidationOutcome = {
  contentSha256: sha,
  contentType: "image/png",
  entityTag: "etag-1",
  height: 5,
  state: "validated",
  validatorVersion: "structural-v1",
  width: 7,
};
export const rejected: AssetValidationOutcome = {
  reason: "malformed",
  state: "rejected",
  validatorVersion: "structural-v1",
};

export function unknownAssetId() {
  return uuidV7Schema.parse(createUuidV7());
}
