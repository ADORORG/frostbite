import type {
  CollectionAggregate,
  CollectionItemRecord,
  CollectionSummaryRecord,
} from "@ador/collections";
import type {
  CollectionDetail,
  CollectionSummary,
} from "@ador/shared/collections";
import { uuidV7Schema, type UuidV7 } from "@ador/shared/identifiers";
import type { LibraryAsset } from "@ador/shared/uploads";

export function presentItem(item: CollectionItemRecord) {
  return {
    attributes: item.attributes.map(({ trait, value }) => ({ trait, value })),
    description: item.description,
    id: item.id,
    imageAssetId: item.imageAssetId,
    name: item.name,
    position: item.position,
  };
}

export function presentSummary(
  record: CollectionSummaryRecord,
): CollectionSummary {
  return {
    coverAssetId: record.coverAssetId,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    itemCount: record.itemCount,
    name: record.name,
    plannedSupply: record.plannedSupply,
    revision: record.revision,
    submissionState: record.submissionState,
    targetChain: record.targetChain,
    updatedAt: record.updatedAt.toISOString(),
  };
}

// Every asset id a draft references, once: the cover, the banner, and each item's image.
export function referencedAssetIds(aggregate: CollectionAggregate): UuidV7[] {
  const { collection, items } = aggregate;
  const ids = [
    ...new Set([
      ...(collection.coverAssetId === null ? [] : [collection.coverAssetId]),
      ...(collection.bannerAssetId === null ? [] : [collection.bannerAssetId]),
      ...items.map(({ imageAssetId }) => imageAssetId),
    ]),
  ];
  return ids.map((id) => uuidV7Schema.parse(id));
}

export function presentDetail(
  aggregate: CollectionAggregate,
  previews: readonly LibraryAsset[],
): CollectionDetail {
  const { collection } = aggregate;
  return {
    collection: {
      bannerAssetId: collection.bannerAssetId,
      coverAssetId: collection.coverAssetId,
      createdAt: collection.createdAt.toISOString(),
      description: collection.description,
      id: collection.id,
      name: collection.name,
      plannedSupply: collection.plannedSupply,
      provenance: collection.provenance,
      revision: collection.revision,
      targetChain: collection.targetChain,
      updatedAt: collection.updatedAt.toISOString(),
    },
    items: aggregate.items.map(presentItem),
    previews: [...previews],
  };
}
