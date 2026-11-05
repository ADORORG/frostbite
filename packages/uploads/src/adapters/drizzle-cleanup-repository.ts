import type { DatabaseClient } from "@frostbite/database/connection";
import { assets, uploadIntents } from "@frostbite/database/schema/uploads";
import { parseObjectKey } from "@frostbite/object-storage/contracts";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import type { UploadCleanupRepository } from "../application/cleanup-repository.ts";

export function createDrizzleUploadCleanupRepository(
  database: DatabaseClient,
): UploadCleanupRepository {
  return {
    async claim({ limit, now, storageProviderId }) {
      return database.transaction(async (transaction) => {
        // SKIP LOCKED leaves rows another pass (or a completion in flight) holds to that owner.
        const rows = await transaction
          .select({
            id: uploadIntents.id,
            objectKey: uploadIntents.objectKey,
            state: uploadIntents.state,
            attempts: uploadIntents.cleanupAttempts,
          })
          .from(uploadIntents)
          .where(
            and(
              eq(uploadIntents.storageProviderId, storageProviderId),
              // Whatever its state says, an object an asset refers to is never claimed.
              notExists(
                transaction
                  .select({ id: assets.id })
                  .from(assets)
                  .where(eq(assets.uploadIntentId, uploadIntents.id)),
              ),
              or(
                and(
                  inArray(uploadIntents.state, ["reserved", "failed"]),
                  lte(uploadIntents.cleanupEligibleAt, now),
                ),
                and(
                  eq(uploadIntents.state, "abandoned"),
                  isNull(uploadIntents.objectRemovedAt),
                  // A removal that failed waits for its retry time.
                  or(
                    isNull(uploadIntents.cleanupRetryAt),
                    lte(uploadIntents.cleanupRetryAt, now),
                  ),
                ),
              ),
            ),
          )
          .orderBy(asc(uploadIntents.cleanupEligibleAt), asc(uploadIntents.id))
          .limit(limit)
          .for("update", { skipLocked: true });
        const fresh = rows
          .filter(({ state }) => state !== "abandoned")
          .map(({ id }) => id);
        if (fresh.length > 0)
          await transaction
            .update(uploadIntents)
            .set({ state: "abandoned", updatedAt: now })
            .where(inArray(uploadIntents.id, fresh));
        return rows.map((row) => ({
          attempts: row.attempts,
          intentId: uuidV7Schema.parse(row.id),
          objectKey: parseObjectKey(row.objectKey),
        }));
      });
    },
    async recordFailure({ intentId, retryAt }) {
      await database
        .update(uploadIntents)
        .set({
          cleanupAttempts: sql`${uploadIntents.cleanupAttempts} + 1`,
          cleanupRetryAt: retryAt,
        })
        .where(
          and(
            eq(uploadIntents.id, intentId),
            eq(uploadIntents.state, "abandoned"),
            isNull(uploadIntents.objectRemovedAt),
          ),
        );
    },
    async markObjectRemoved({ intentId, removedAt }) {
      await database
        .update(uploadIntents)
        .set({ objectRemovedAt: removedAt, updatedAt: removedAt })
        .where(
          and(
            eq(uploadIntents.id, intentId),
            eq(uploadIntents.state, "abandoned"),
            isNull(uploadIntents.objectRemovedAt),
          ),
        );
    },
  };
}
