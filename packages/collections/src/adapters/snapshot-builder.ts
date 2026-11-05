import type { Collection, CollectionItemRow } from "@frostbite/database";
import {
  submissionSchemaVersion,
  submissionSnapshotSchema,
  type SubmissionSnapshot,
} from "@frostbite/shared/collections";
import { chainRefTextSchema } from "@frostbite/shared/chain";

import { itemRecord } from "./views.ts";
import type { ValidAsset } from "./guards.ts";

// The frozen copy of a collection: its own fields, its items in order, and the content hash of every
// image it uses, in a fixed order so the same collection always yields the same snapshot. Parsing it
// through the shared schema means nothing malformed can ever be stored as a reviewed version.
export function buildSnapshot(input: {
  readonly assets: readonly ValidAsset[];
  readonly collection: Collection;
  readonly items: readonly CollectionItemRow[];
}): SubmissionSnapshot {
  const { collection } = input;
  return submissionSnapshotSchema.parse({
    assets: [...input.assets].sort((left, right) =>
      `${left.purpose}:${left.id}` < `${right.purpose}:${right.id}` ? -1 : 1,
    ),
    collection: {
      bannerAssetId: collection.bannerAssetId,
      coverAssetId: collection.coverAssetId,
      description: collection.description,
      name: collection.name,
      plannedSupply: collection.plannedSupply,
      provenance: collection.provenance,
      targetChain: chainRefTextSchema.parse(collection.chainId),
    },
    items: input.items.map(itemRecord),
    schemaVersion: submissionSchemaVersion,
  });
}
