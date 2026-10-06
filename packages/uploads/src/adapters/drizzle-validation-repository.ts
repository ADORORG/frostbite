import type { DatabaseClient } from "@ador/database/connection";
import { assets, uploadIntents } from "@ador/database/schema/uploads";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { and, eq } from "drizzle-orm";

import type {
  AssetValidationOutcome,
  AssetValidationRepository,
} from "../application/validation-repository.ts";

type AssetRow = typeof assets.$inferSelect;

// assets_validation_coherent makes a null here unrepresentable for the matching state; the guard
// keeps the types honest without non-null assertions.
function required<T>(value: T | null): T {
  /* v8 ignore next -- the coherence CHECK rejects every row that would reach this. */
  if (value === null) throw new Error("Asset validation record is incoherent.");
  return value;
}

function outcomeOf(row: AssetRow): AssetValidationOutcome {
  const validatorVersion = required(row.validatorVersion);
  // Every state after validation (validated, processed, unprocessable) keeps its validated outcome.
  return row.processingState !== "rejected"
    ? {
        contentSha256: required(row.contentSha256),
        contentType: required(row.detectedContentType),
        entityTag: required(row.validatedEntityTag),
        height: required(row.heightPixels),
        state: "validated",
        validatorVersion,
        width: required(row.widthPixels),
      }
    : {
        reason: required(row.rejectionReason),
        state: "rejected",
        validatorVersion,
      };
}

export function createDrizzleAssetValidationRepository(
  database: DatabaseClient,
): AssetValidationRepository {
  return {
    async find(assetId) {
      const [row] = await database
        .select({ asset: assets, intent: uploadIntents })
        .from(assets)
        .innerJoin(uploadIntents, eq(uploadIntents.id, assets.uploadIntentId))
        .where(eq(assets.id, assetId));
      if (row === undefined) return { kind: "missing" };
      if (row.asset.processingState !== "pending-validation")
        return { kind: "final", outcome: outcomeOf(row.asset) };
      return {
        kind: "pending",
        subject: {
          assetId: uuidV7Schema.parse(row.asset.id),
          declaredByteLength: row.intent.byteLength,
          declaredContentType: row.intent.contentType,
          objectKey: parseObjectKey(row.asset.objectKey),
          purpose: row.intent.purpose,
          storageProviderId: providerIdSchema.parse(
            row.asset.storageProviderId,
          ),
        },
      };
    },
    async record({ assetId, completedAt, outcome }) {
      const common = {
        updatedAt: completedAt,
        validationCompletedAt: completedAt,
        validatorVersion: outcome.validatorVersion,
      };
      const [updated] = await database
        .update(assets)
        .set(
          outcome.state === "validated"
            ? {
                ...common,
                contentSha256: outcome.contentSha256,
                detectedContentType: outcome.contentType,
                heightPixels: outcome.height,
                processingState: "validated",
                validatedEntityTag: outcome.entityTag,
                widthPixels: outcome.width,
              }
            : {
                ...common,
                processingState: "rejected",
                rejectionReason: outcome.reason,
              },
        )
        .where(
          and(
            eq(assets.id, assetId),
            eq(assets.processingState, "pending-validation"),
          ),
        )
        .returning();
      if (updated !== undefined) return { kind: "recorded", outcome };
      const [current] = await database
        .select()
        .from(assets)
        .where(eq(assets.id, assetId));
      /* v8 ignore next -- assets are never deleted and the caller found this asset first. */
      if (current === undefined) throw new Error("Asset disappeared.");
      return { kind: "replayed", outcome: outcomeOf(current) };
    },
  };
}
