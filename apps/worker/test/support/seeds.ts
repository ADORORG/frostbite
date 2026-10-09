import { randomUUID } from "node:crypto";

import { authUsers, uploadIntents } from "@ador/database";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { correlationIdSchema, idempotencyKeySchema } from "@ador/shared/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { createDrizzleUploadIntentRepository } from "@ador/uploads";

import { database, now } from "./database.ts";
import { memoryStorage, storageProviderId } from "./fakes.ts";
import { tinyPng } from "./png.ts";

// A reserved intent whose upload window and cleanup delay have both passed, as left behind by a
// browser that never completed (the object may or may not have been written).
export async function seedAbandonedUpload(options: {
  readonly bytes?: Buffer;
  readonly storage: ReturnType<typeof memoryStorage>;
}) {
  const userId = createUuidV7();
  const intentId = createUuidV7();
  const objectKey = parseObjectKey(`drafts/${randomUUID()}`);
  const day = 86_400_000;
  await database
    .insert(authUsers)
    .values({ email: `${userId}@example.test`, id: userId, name: "Uploader" });
  await database.insert(uploadIntents).values({
    byteLength: options.bytes?.length ?? 100,
    cleanupEligibleAt: new Date(now.getTime() - day),
    contentType: "image/png",
    expiresAt: new Date(now.getTime() - 2 * day),
    id: intentId,
    idempotencyKey: `abandoned-${intentId}`,
    objectKey,
    purpose: "collection-artwork",
    requestFingerprint: "a".repeat(64),
    retainUntil: new Date(now.getTime() + 29 * day),
    storageProviderId,
    userId,
  });
  if (options.bytes !== undefined)
    options.storage.objects.set(objectKey, options.bytes);
  return { intentId, objectKey, userId };
}

// An upload that has just completed: a reserved intent turned into a pending asset plus its outbox
// event, in one transaction, exactly as the upload feature does it.
export async function seedCompletedUpload(options: { bytes: Buffer }) {
  const userId = createUuidV7();
  const intentId = createUuidV7();
  const assetId = createUuidV7();
  const eventId = createUuidV7();
  const objectKey = parseObjectKey(`drafts/${randomUUID()}`);
  await database
    .insert(authUsers)
    .values({ email: `${userId}@example.test`, id: userId, name: "Uploader" });
  const repository = createDrizzleUploadIntentRepository(database);
  await repository.reserve({
    activeLimit: 1,
    byteLength: options.bytes.length,
    cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
    contentType: "image/png",
    createdAt: now,
    expiresAt: new Date(now.getTime() + 900_000),
    id: intentId,
    idempotencyKey: idempotencyKeySchema.parse("upload-request-0001"),
    objectKey,
    purpose: "collection-artwork",
    requestFingerprint: "a".repeat(64),
    retainUntil: new Date(now.getTime() + 2_592_000_000),
    storageProviderId,
    userId,
  });
  await repository.complete({
    assetId,
    completedAt: new Date(),
    event: {
      causationId: null,
      correlationId: correlationIdSchema.parse(createUuidV7()),
      eventId,
      name: "uploads.assetprocessing.requested.v1",
      occurredAt: new Date().toISOString(),
      payload: { assetId, uploadIntentId: intentId },
      schemaVersion: 1,
    },
    intentId,
    object: {
      contentLength: options.bytes.length,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
      providerId: storageProviderId,
    },
    userId,
  });
  return { assetId, eventId, intentId, objectKey };
}

export const validPng = () => tinyPng(7, 5);
