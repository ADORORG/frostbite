import type { DatabaseClient } from "@frostbite/database/connection";
import { enqueueOutboxEvent } from "@frostbite/database/outbox";
import { authUsers } from "@frostbite/database/schema/auth";
import { assets, uploadIntents } from "@frostbite/database/schema/uploads";
import { parseObjectKey } from "@frostbite/object-storage/contracts";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import { providerIdSchema } from "@frostbite/shared/providers";
import {
  assetProcessingRequestedEvent,
  assetProcessingRequestedPayloadSchema,
} from "@frostbite/shared/uploads";
import { and, count, eq, gt } from "drizzle-orm";

import type { UploadIntentRepository } from "../application/repository.ts";

function view(row: typeof uploadIntents.$inferSelect) {
  return {
    byteLength: row.byteLength,
    contentType: row.contentType,
    expiresAt: row.expiresAt,
    id: uuidV7Schema.parse(row.id),
    objectKey: parseObjectKey(row.objectKey),
    purpose: row.purpose,
    storageProviderId: providerIdSchema.parse(row.storageProviderId),
  };
}

function assertMatchingProcessingEvent(
  input: Parameters<UploadIntentRepository["complete"]>[0],
): void {
  const payload = assetProcessingRequestedPayloadSchema.parse(
    input.event.payload,
  );
  if (
    input.event.name !== assetProcessingRequestedEvent.name ||
    input.event.schemaVersion !== assetProcessingRequestedEvent.schemaVersion ||
    payload.assetId !== input.assetId ||
    payload.uploadIntentId !== input.intentId
  ) {
    throw new Error("Processing event does not match the completed upload.");
  }
}

export function createDrizzleUploadIntentRepository(
  database: DatabaseClient,
): UploadIntentRepository {
  return {
    async complete(input) {
      return database.transaction(async (transaction) => {
        assertMatchingProcessingEvent(input);
        const [intent] = await transaction
          .select()
          .from(uploadIntents)
          .where(
            and(
              eq(uploadIntents.id, input.intentId),
              eq(uploadIntents.userId, input.userId),
            ),
          )
          .limit(1)
          .for("update");
        if (intent === undefined) return { kind: "unavailable" };
        const [existing] = await transaction
          .select({ id: assets.id, processingState: assets.processingState })
          .from(assets)
          .where(eq(assets.uploadIntentId, intent.id))
          .limit(1);
        if (existing !== undefined) {
          return {
            asset: {
              id: uuidV7Schema.parse(existing.id),
              processingState: existing.processingState,
            },
            kind: "replayed",
          };
        }
        if (
          intent.state !== "reserved" ||
          intent.expiresAt <= input.completedAt ||
          intent.storageProviderId !== input.object.providerId
        )
          return { kind: "unavailable" };
        const [asset] = await transaction
          .insert(assets)
          .values({
            id: input.assetId,
            objectKey: intent.objectKey,
            observedByteLength: input.object.contentLength,
            observedContentType: input.object.contentType,
            observedEntityTag: input.object.entityTag,
            observedLastModifiedAt: input.object.lastModified,
            processingState: "pending-validation",
            storageProviderId: input.object.providerId,
            uploadIntentId: intent.id,
            userId: intent.userId,
          })
          .returning({
            id: assets.id,
            processingState: assets.processingState,
          });
        /* v8 ignore next -- INSERT RETURNING either throws or returns its inserted row. */
        if (asset === undefined) return { kind: "unavailable" };
        await transaction
          .update(uploadIntents)
          .set({ state: "completed", updatedAt: input.completedAt })
          .where(eq(uploadIntents.id, intent.id));
        await enqueueOutboxEvent(transaction, input.event);
        return {
          asset: {
            id: uuidV7Schema.parse(asset.id),
            processingState: asset.processingState,
          },
          kind: "completed",
        };
      });
    },
    async findForCompletion({ intentId, now, userId }) {
      const [intent] = await database
        .select()
        .from(uploadIntents)
        .where(
          and(eq(uploadIntents.id, intentId), eq(uploadIntents.userId, userId)),
        )
        .limit(1);
      if (intent === undefined) return { kind: "unavailable" };
      const [asset] = await database
        .select({ id: assets.id, processingState: assets.processingState })
        .from(assets)
        .where(eq(assets.uploadIntentId, intent.id))
        .limit(1);
      if (asset !== undefined) {
        return {
          asset: {
            id: uuidV7Schema.parse(asset.id),
            processingState: asset.processingState,
          },
          kind: "completed",
        };
      }
      if (intent.state !== "reserved" || intent.expiresAt <= now)
        return { kind: "unavailable" };
      return { intent: view(intent), kind: "ready" };
    },
    async markSigningFailed({ failedAt, intentId, userId }) {
      await database
        .update(uploadIntents)
        .set({ state: "failed", updatedAt: failedAt })
        .where(
          and(
            eq(uploadIntents.id, intentId),
            eq(uploadIntents.userId, userId),
            eq(uploadIntents.state, "reserved"),
          ),
        );
    },
    async reserve(input) {
      return database.transaction(async (transaction) => {
        await transaction
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, input.userId))
          .for("update");
        const [existing] = await transaction
          .select()
          .from(uploadIntents)
          .where(
            and(
              eq(uploadIntents.userId, input.userId),
              eq(uploadIntents.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1);
        if (existing !== undefined) {
          if (existing.requestFingerprint !== input.requestFingerprint)
            return { kind: "conflict" };
          if (
            existing.state === "reserved" &&
            existing.expiresAt > input.createdAt
          )
            return { intent: view(existing), kind: "replayed" };
          if (existing.state !== "failed") return { kind: "conflict" };
          const [retried] = await transaction
            .update(uploadIntents)
            .set({
              cleanupEligibleAt: input.cleanupEligibleAt,
              expiresAt: input.expiresAt,
              retainUntil: input.retainUntil,
              state: "reserved",
              updatedAt: input.createdAt,
            })
            .where(eq(uploadIntents.id, existing.id))
            .returning();
          /* v8 ignore next -- PostgreSQL UPDATE RETURNING either throws or returns the matched row. */
          return retried === undefined
            ? { kind: "conflict" }
            : { intent: view(retried), kind: "reserved" };
        }
        const [active] = await transaction
          .select({ value: count() })
          .from(uploadIntents)
          .where(
            and(
              eq(uploadIntents.userId, input.userId),
              eq(uploadIntents.state, "reserved"),
              gt(uploadIntents.expiresAt, input.createdAt),
            ),
          );
        if ((active?.value ?? 0) >= input.activeLimit)
          return { kind: "quota-exceeded" };
        const [inserted] = await transaction
          .insert(uploadIntents)
          .values(input)
          .returning();
        return inserted === undefined
          ? { kind: "conflict" }
          : { intent: view(inserted), kind: "reserved" };
      });
    },
  };
}
