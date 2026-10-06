import type { DatabaseClient } from "@ador/database/connection";
import { assetDerivatives } from "@ador/database/schema/derivatives";
import { assets, uploadIntents } from "@ador/database/schema/uploads";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { desc, eq, inArray } from "drizzle-orm";

import type {
  AssetLibraryRepository,
  LibraryDerivativeRecord,
} from "../application/library-repository.ts";

export function createDrizzleAssetLibraryRepository(
  database: DatabaseClient,
): AssetLibraryRepository {
  return {
    async listNewestForUser({ limit, userId }) {
      const rows = await database
        .select({ asset: assets, purpose: uploadIntents.purpose })
        .from(assets)
        .innerJoin(uploadIntents, eq(uploadIntents.id, assets.uploadIntentId))
        .where(eq(assets.userId, userId))
        .orderBy(desc(assets.createdAt), desc(assets.id))
        .limit(limit);
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
      return rows.map(({ asset, purpose }) => ({
        createdAt: asset.createdAt,
        derivatives: [...(current.get(asset.id)?.values() ?? [])],
        heightPixels: asset.heightPixels,
        id: uuidV7Schema.parse(asset.id),
        processingState: asset.processingState,
        purpose,
        rejectionReason: asset.rejectionReason,
        widthPixels: asset.widthPixels,
      }));
    },
  };
}
