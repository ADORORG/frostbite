import type { Collection, CollectionItemRow } from "@ador/database";
import { chainRefTextSchema } from "@ador/shared/chain";
import { uuidV7Schema } from "@ador/shared/identifiers";

import type {
  CollectionItemRecord,
  CollectionRecord,
} from "../application/repository.ts";

export function collectionRecord(row: Collection): CollectionRecord {
  return {
    bannerAssetId: row.bannerAssetId,
    coverAssetId: row.coverAssetId,
    createdAt: row.createdAt,
    description: row.description,
    id: uuidV7Schema.parse(row.id),
    name: row.name,
    plannedSupply: row.plannedSupply,
    provenance: row.provenance,
    revision: row.revision,
    targetChain: chainRefTextSchema.parse(row.chainId),
    updatedAt: row.updatedAt,
  };
}

export function itemRecord(row: CollectionItemRow): CollectionItemRecord {
  return {
    attributes: row.attributes,
    description: row.description,
    id: uuidV7Schema.parse(row.id),
    imageAssetId: row.imageAssetId,
    name: row.name,
    position: row.position,
  };
}
