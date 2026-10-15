import {
  assets,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  outboxEvents,
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@ador/database";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { correlationIdSchema } from "@ador/shared/http";
import { createUuidV7, type UuidV7 } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { eq } from "drizzle-orm";

import { createDrizzleUploadIntentRepository } from "../../src/adapters/drizzle-repository.ts";
import { createDrizzleUploadCleanupRepository } from "../../src/adapters/drizzle-cleanup-repository.ts";

export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const cleanupRepository = createDrizzleUploadCleanupRepository(database);
export const intentRepository = createDrizzleUploadIntentRepository(database);
export const now = new Date("2026-09-20T12:00:00.000Z");
export const providerId = providerIdSchema.parse("test-object-storage");
const day = 86_400_000;

export const migrate = () => runMigrations(environment);
export async function resetTables(): Promise<void> {
  await database.delete(assets);
  await database.delete(outboxEvents);
  await database.delete(uploadIntents);
  await database.delete(authUsers);
}

export async function createUser(): Promise<UuidV7> {
  const id = createUuidV7();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Uploader" });
  return id;
}

type IntentState = (typeof uploadIntents.$inferInsert)["state"];

// Inserted directly so each state and time can be set exactly. `cleanupDueInMs` is when cleanup
// becomes due relative to `now` (negative: already due; the default is one second ago).
export async function seedIntent(
  userId: UuidV7,
  options: {
    readonly cleanupDueInMs?: number;
    readonly state?: IntentState;
    readonly storageProvider?: string;
  } = {},
) {
  const id = createUuidV7();
  const objectKey = parseObjectKey(`drafts/${createUuidV7()}`);
  const cleanupEligibleAt = new Date(
    now.getTime() + (options.cleanupDueInMs ?? -1_000),
  );
  await database.insert(uploadIntents).values({
    byteLength: 100,
    cleanupEligibleAt,
    contentType: "image/png",
    expiresAt: new Date(cleanupEligibleAt.getTime() - day),
    id,
    idempotencyKey: `seed-${id}`,
    objectKey,
    purpose: "creator-avatar",
    requestFingerprint: "a".repeat(64),
    retainUntil: new Date(cleanupEligibleAt.getTime() + 30 * day),
    state: options.state ?? "reserved",
    storageProviderId: options.storageProvider ?? providerId,
    userId,
  });
  return { id, objectKey, userId };
}

// Completes a live intent for real, so an asset (and its outbox event) exists for it.
export async function completeWithAsset(userId: UuidV7) {
  const intent = await seedIntent(userId, { cleanupDueInMs: day });
  // The seeded window must still be open at completion time for the repository to accept it.
  await database
    .update(uploadIntents)
    .set({ expiresAt: new Date(now.getTime() + 900_000) })
    .where(eqId(intent.id));
  const assetId = createUuidV7();
  const result = await intentRepository.complete({
    assetId,
    completedAt: now,
    event: {
      causationId: null,
      correlationId: correlationIdSchema.parse(createUuidV7()),
      eventId: createUuidV7(),
      name: "uploads.assetprocessing.requested.v1",
      occurredAt: now.toISOString(),
      payload: { assetId, uploadIntentId: intent.id },
      schemaVersion: 1,
    },
    intentId: intent.id,
    object: {
      contentLength: 100,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
      providerId,
    },
    userId,
  });
  if (result.kind !== "completed")
    throw new Error("The seeded intent did not complete.");
  return { ...intent, assetId };
}

const eqId = (id: UuidV7) => eq(uploadIntents.id, id);

export async function stateOf(id: UuidV7) {
  const [row] = await database
    .select({
      objectRemovedAt: uploadIntents.objectRemovedAt,
      state: uploadIntents.state,
    })
    .from(uploadIntents)
    .where(eqId(id));
  if (row === undefined) throw new Error("Intent row is missing.");
  return row;
}

// How many removals of this intent's object have failed.
export async function attemptsOf(id: UuidV7): Promise<number> {
  const [row] = await database
    .select({ attempts: uploadIntents.cleanupAttempts })
    .from(uploadIntents)
    .where(eqId(id));
  if (row === undefined) throw new Error("Intent row is missing.");
  return row.attempts;
}
