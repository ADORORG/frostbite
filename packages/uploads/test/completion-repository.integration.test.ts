import {
  assets,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  outboxEvents,
  parseDatabaseEnvironment,
  runMigrations,
  uploadIntents,
} from "@frostbite/database";
import { parseObjectKey } from "@frostbite/object-storage/contracts";
import {
  correlationIdSchema,
  idempotencyKeySchema,
} from "@frostbite/shared/http";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { providerIdSchema } from "@frostbite/shared/providers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDrizzleUploadIntentRepository } from "../src/adapters/drizzle-repository.ts";
import type { UploadIntentView } from "../src/application/repository.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const repository = createDrizzleUploadIntentRepository(database);
const now = new Date("2026-09-13T12:00:00.000Z");

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(assets);
  await database.delete(outboxEvents);
  await database.delete(uploadIntents);
  await database.delete(authUsers);
});
afterAll(async () => pool.end());

async function reserve(expiresAt = new Date(now.getTime() + 900_000)) {
  const userId = createUuidV7();
  const intent: UploadIntentView = {
    byteLength: 100,
    contentType: "image/png",
    expiresAt,
    id: createUuidV7(),
    objectKey: parseObjectKey(`drafts/${createUuidV7()}`),
    purpose: "creator-avatar",
    storageProviderId: providerIdSchema.parse("test-object-storage"),
  };
  await database.insert(authUsers).values({
    email: `${userId}@example.test`,
    id: userId,
    name: "Uploader",
  });
  await repository.reserve({
    ...intent,
    activeLimit: 1,
    cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
    createdAt: now,
    idempotencyKey: idempotencyKeySchema.parse("upload-request-0001"),
    requestFingerprint: "a".repeat(64),
    retainUntil: new Date(now.getTime() + 2_592_000_000),
    userId,
  });
  return { intent, userId };
}

function completion(
  intentId: Awaited<ReturnType<typeof reserve>>["intent"]["id"],
  userId: Awaited<ReturnType<typeof reserve>>["userId"],
) {
  const assetId = createUuidV7();
  return {
    assetId,
    completedAt: now,
    event: {
      causationId: null,
      correlationId: correlationIdSchema.parse(createUuidV7()),
      eventId: createUuidV7(),
      name: "uploads.assetprocessing.requested.v1",
      occurredAt: now.toISOString(),
      payload: { assetId, uploadIntentId: intentId },
      schemaVersion: 1,
    },
    intentId,
    object: {
      contentLength: 100,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
      providerId: providerIdSchema.parse("test-object-storage"),
    },
    userId,
  };
}

describe("upload completion persistence", () => {
  it("returns a live owned reservation as ready for storage inspection", async () => {
    const { intent, userId } = await reserve();
    await expect(
      repository.findForCompletion({ intentId: intent.id, now, userId }),
    ).resolves.toMatchObject({ intent: { id: intent.id }, kind: "ready" });
  });

  it("atomically creates one pending asset, completes its intent, and enqueues IDs", async () => {
    const { intent, userId } = await reserve();
    const input = completion(intent.id, userId);
    await expect(repository.complete(input)).resolves.toMatchObject({
      asset: { id: input.assetId, processingState: "pending-validation" },
      kind: "completed",
    });
    await expect(
      repository.findForCompletion({
        intentId: intent.id,
        now,
        userId,
      }),
    ).resolves.toMatchObject({
      asset: { id: input.assetId },
      kind: "completed",
    });
    const [storedIntent] = await database.select().from(uploadIntents);
    const [storedAsset] = await database.select().from(assets);
    const [event] = await database.select().from(outboxEvents);
    expect(storedIntent?.state).toBe("completed");
    expect(storedAsset).toMatchObject({
      id: input.assetId,
      observedByteLength: 100,
      storageProviderId: "test-object-storage",
    });
    expect(event).toMatchObject({
      eventName: "uploads.assetprocessing.requested.v1",
      payload: { assetId: input.assetId, uploadIntentId: intent.id },
    });
  });

  it("serializes concurrent completion into one asset and one event", async () => {
    const { intent, userId } = await reserve();
    const results = await Promise.all([
      repository.complete(completion(intent.id, userId)),
      repository.complete(completion(intent.id, userId)),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "completed",
      "replayed",
    ]);
    expect(
      new Set(
        results.map((result) =>
          result.kind === "unavailable" ? "" : result.asset.id,
        ),
      ),
    ).toHaveProperty("size", 1);
    await expect(database.select().from(assets)).resolves.toHaveLength(1);
    await expect(database.select().from(outboxEvents)).resolves.toHaveLength(1);
  });

  it("hides another user's and expired intents", async () => {
    const owned = await reserve(new Date(now.getTime() - 1));
    const otherUserId = createUuidV7();
    await database.insert(authUsers).values({
      email: `${otherUserId}@example.test`,
      id: otherUserId,
      name: "Other",
    });
    await expect(
      repository.complete(completion(owned.intent.id, owned.userId)),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      repository.findForCompletion({
        intentId: owned.intent.id,
        now,
        userId: otherUserId,
      }),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(
      repository.complete(completion(owned.intent.id, otherUserId)),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(database.select().from(assets)).resolves.toHaveLength(0);
  });

  it("refuses another user completing a live intent, creating no asset and leaving it completable by its owner", async () => {
    const live = await reserve();
    const otherUserId = createUuidV7();
    await database.insert(authUsers).values({
      email: `${otherUserId}@example.test`,
      id: otherUserId,
      name: "Other",
    });
    await expect(
      repository.complete(completion(live.intent.id, otherUserId)),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(database.select().from(assets)).resolves.toHaveLength(0);
    await expect(database.select().from(outboxEvents)).resolves.toHaveLength(0);
    await expect(
      repository.complete(completion(live.intent.id, live.userId)),
    ).resolves.toMatchObject({ kind: "completed" });
  });

  it("refuses completion evidence from a different storage provider", async () => {
    const { intent, userId } = await reserve();
    const input = completion(intent.id, userId);
    await expect(
      repository.complete({
        ...input,
        object: {
          ...input.object,
          providerId: providerIdSchema.parse("different-storage"),
        },
      }),
    ).resolves.toEqual({ kind: "unavailable" });
    await expect(database.select().from(assets)).resolves.toHaveLength(0);
  });

  it("rolls back asset and intent when the outbox event is invalid", async () => {
    const { intent, userId } = await reserve();
    const input = completion(intent.id, userId);
    await expect(
      repository.complete({
        ...input,
        event: { ...input.event, occurredAt: "invalid" },
      }),
    ).rejects.toThrow("Invalid ISO datetime");
    const [storedIntent] = await database.select().from(uploadIntents);
    expect(storedIntent?.state).toBe("reserved");
    await expect(database.select().from(assets)).resolves.toHaveLength(0);
  });

  it("rejects a processing event addressed to a different asset", async () => {
    const { intent, userId } = await reserve();
    const input = completion(intent.id, userId);
    await expect(
      repository.complete({
        ...input,
        event: {
          ...input.event,
          payload: { ...input.event.payload, assetId: createUuidV7() },
        },
      }),
    ).rejects.toThrow("does not match");
    const [storedIntent] = await database.select().from(uploadIntents);
    expect(storedIntent?.state).toBe("reserved");
    await expect(database.select().from(assets)).resolves.toHaveLength(0);
  });
});
