import type {
  CollectionAggregate,
  createCollectionService,
} from "@frostbite/collections";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { CollectionDetail } from "@frostbite/shared/collections";
import type { createAssetLibraryService } from "@frostbite/uploads";

import { presentDetail, referencedAssetIds } from "./present.ts";

export type CollectionService = ReturnType<typeof createCollectionService>;
export type AssetPreviews = Pick<
  ReturnType<typeof createAssetLibraryService>,
  "getMany"
>;

export interface OperationDependencies {
  readonly getPreviews: () => Promise<AssetPreviews>;
  readonly getService: () => Promise<CollectionService>;
}

// The draft as the creator sees it: its records plus a preview (state and signed renditions) of every
// image it references.
export async function detailOf(
  dependencies: OperationDependencies,
  ownerUserId: UuidV7,
  aggregate: CollectionAggregate,
): Promise<CollectionDetail> {
  const ids = referencedAssetIds(aggregate);
  const previews =
    ids.length === 0
      ? []
      : await (await dependencies.getPreviews()).getMany(ownerUserId, ids);
  return presentDetail(aggregate, previews);
}
