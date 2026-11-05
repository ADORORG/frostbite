import type { DatabaseClient } from "@frostbite/database/connection";
import { assetDerivatives } from "@frostbite/database/schema/derivatives";
import { assets, uploadIntents } from "@frostbite/database/schema/uploads";
import { parseObjectKey } from "@frostbite/object-storage/contracts";
import { uuidV7Schema } from "@frostbite/shared/identifiers";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  AssetLibraryRepository,
  LibraryAssetRecord,
  LibraryDerivativeRecord,
} from "../application/library-repository.ts";

type AssetRow = {
  readonly asset: typeof assets.$inferSelect;
  readonly fileName: typeof uploadIntents.$inferSelect.fileName;
  readonly purpose: typeof uploadIntents.$inferSelect.purpose;
};

// Attaches each asset's current renditions (the newest of every kind) to its row.
async function withDerivatives(
  database: DatabaseClient,
  rows: readonly AssetRow[],
): Promise<readonly LibraryAssetRecord[]> {
  if (rows.length === 0) return [];
  const derivativeRows = await database
    .select()
    .from(assetDerivatives)
    .where(
      inArray(
        assetDerivatives.assetId,
        rows.map(({ asset }) => asset.id),
      ),
    )
    .orderBy(desc(assetDerivatives.createdAt), desc(assetDerivatives.id));
  // Newest first, so the first row seen per (asset, kind) is the current rendition.
  const current = new Map<string, Map<string, LibraryDerivativeRecord>>();
  for (const row of derivativeRows) {
    const kinds = current.get(row.assetId) ?? new Map();
    current.set(row.assetId, kinds);
    if (!kinds.has(row.kind))
      kinds.set(row.kind, {
        contentType: row.contentType,
        heightPixels: row.heightPixels,
        kind: row.kind,
        objectKey: parseObjectKey(row.objectKey),
        widthPixels: row.widthPixels,
      });
  }
  return rows.map(({ asset, fileName, purpose }) => ({
    createdAt: asset.createdAt,
    derivatives: [...(current.get(asset.id)?.values() ?? [])],
    fileName,
    heightPixels: asset.heightPixels,
    id: uuidV7Schema.parse(asset.id),
    processingState: asset.processingState,
    purpose,
    rejectionReason: asset.rejectionReason,
    widthPixels: asset.widthPixels,
  }));
}

export function createDrizzleAssetLibraryRepository(
  database: DatabaseClient,
): AssetLibraryRepository {
  return {
    async listByIdsForUser({ assetIds, userId }) {
      if (assetIds.length === 0) return [];
      const rows = await database
        .select({
          asset: assets,
          fileName: uploadIntents.fileName,
          purpose: uploadIntents.purpose,
        })
        .from(assets)
        .innerJoin(uploadIntents, eq(uploadIntents.id, assets.uploadIntentId))
        .where(
          and(eq(assets.userId, userId), inArray(assets.id, [...assetIds])),
        );
      return withDerivatives(database, rows);
    },

    async listNewestForUser({ before, limit, userId }) {
      // Ordered and compared at the millisecond, which is all a cursor carries, so a page never skips or repeats a row.
      const createdMs = sql`date_trunc('milliseconds', ${assets.createdAt})`;
      const rows = await database
        .select({
          asset: assets,
          fileName: uploadIntents.fileName,
          purpose: uploadIntents.purpose,
        })
        .from(assets)
        .innerJoin(uploadIntents, eq(uploadIntents.id, assets.uploadIntentId))
        .where(
          and(
            eq(assets.userId, userId),
            before === undefined
              ? undefined
              : sql`(${createdMs}, ${assets.id}) < (${new Date(before.createdAtMs)}, ${before.id})`,
          ),
        )
        .orderBy(desc(createdMs), desc(assets.id))
        .limit(limit);
      return withDerivatives(database, rows);
    },
  };
}
