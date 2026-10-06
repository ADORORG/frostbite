import type { DatabaseClient } from "@ador/database/connection";
import { assetDerivatives } from "@ador/database/schema/derivatives";
import { assets } from "@ador/database/schema/uploads";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { and, asc, eq } from "drizzle-orm";

import type {
  AssetProcessingOutcome,
  AssetProcessingRepository,
  StoredDerivative,
} from "../application/processing-repository.ts";

type Reader = Pick<DatabaseClient, "select">;

// assets_validation_coherent makes a null here unrepresentable for the matching state; the guard
// keeps the types honest without non-null assertions.
function required<T>(value: T | null): T {
  /* v8 ignore next -- the coherence CHECK rejects every row that would reach this. */
  if (value === null) throw new Error("Asset processing record is incoherent.");
  return value;
}

async function finalOutcome(
  reader: Reader,
  asset: typeof assets.$inferSelect,
): Promise<AssetProcessingOutcome> {
  if (asset.processingState === "unprocessable")
    return {
      reason: required(asset.rejectionReason),
      state: "unprocessable",
    };
  // Only a final state has an outcome; recording against any other asset is a caller error.
  if (asset.processingState !== "processed")
    throw new Error(
      `Asset is ${asset.processingState}, not ready to record a processing outcome.`,
    );
  const rows = await reader
    .select()
    .from(assetDerivatives)
    .where(eq(assetDerivatives.assetId, asset.id))
    .orderBy(asc(assetDerivatives.kind));
  const derivatives: StoredDerivative[] = rows.map((row) => ({
    byteLength: row.byteLength,
    contentSha256: row.contentSha256,
    contentType: row.contentType,
    height: row.heightPixels,
    kind: row.kind,
    objectKey: parseObjectKey(row.objectKey),
    specVersion: row.specVersion,
    storageProviderId: providerIdSchema.parse(row.storageProviderId),
    width: row.widthPixels,
  }));
  return { derivatives, state: "processed" };
}

export function createDrizzleAssetProcessingRepository(
  database: DatabaseClient,
): AssetProcessingRepository {
  return {
    async find(assetId) {
      const [asset] = await database
        .select()
        .from(assets)
        .where(eq(assets.id, assetId));
      if (asset === undefined) return { kind: "missing" };
      if (asset.processingState === "validated")
        return {
          kind: "pending",
          subject: {
            assetId: uuidV7Schema.parse(asset.id),
            byteLength: asset.observedByteLength,
            contentSha256: required(asset.contentSha256),
            height: required(asset.heightPixels),
            objectKey: parseObjectKey(asset.objectKey),
            storageProviderId: providerIdSchema.parse(asset.storageProviderId),
            width: required(asset.widthPixels),
          },
        };
      if (
        asset.processingState === "processed" ||
        asset.processingState === "unprocessable"
      )
        return {
          kind: "final",
          outcome: await finalOutcome(database, asset),
        };
      return { kind: "not-ready", state: asset.processingState };
    },
    async record({ assetId, completedAt, createId, outcome }) {
      return database.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(assets)
          .set(
            outcome.state === "processed"
              ? {
                  processingCompletedAt: completedAt,
                  processingState: "processed",
                  updatedAt: completedAt,
                }
              : {
                  processingCompletedAt: completedAt,
                  processingState: "unprocessable",
                  rejectionReason: outcome.reason,
                  updatedAt: completedAt,
                },
          )
          .where(
            and(
              eq(assets.id, assetId),
              eq(assets.processingState, "validated"),
            ),
          )
          .returning({ id: assets.id });
        if (updated !== undefined) {
          if (outcome.state === "processed")
            await transaction.insert(assetDerivatives).values(
              outcome.derivatives.map((derivative) => ({
                assetId,
                byteLength: derivative.byteLength,
                contentSha256: derivative.contentSha256,
                contentType: derivative.contentType,
                heightPixels: derivative.height,
                id: createId(),
                kind: derivative.kind,
                objectKey: derivative.objectKey,
                specVersion: derivative.specVersion,
                storageProviderId: derivative.storageProviderId,
                widthPixels: derivative.width,
              })),
            );
          return { kind: "recorded", outcome };
        }
        const [current] = await transaction
          .select()
          .from(assets)
          .where(eq(assets.id, assetId));
        /* v8 ignore next -- assets are never deleted and the caller found this asset first. */
        if (current === undefined) throw new Error("Asset disappeared.");
        return {
          kind: "replayed",
          outcome: await finalOutcome(transaction, current),
        };
      });
    },
  };
}
