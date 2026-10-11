import type { CollectionDetail } from "@ador/shared/collections";
import type { LibraryAsset } from "@ador/shared/uploads";
import { libraryAssetFixture } from "@ador/test-kit/library-asset";

import { id, signet } from "./stubs.ts";

const at = "2026-10-09T12:00:00.000Z";

export function itemRecord(
  position: number,
  imageAssetId = id(),
  name = `Item ${position}`,
) {
  return {
    attributes: [{ trait: "Colour", value: "Blue" }],
    description: "",
    id: id(),
    imageAssetId,
    name,
    position,
  };
}

export function detail(
  collection: Partial<CollectionDetail["collection"]> = {},
  items: CollectionDetail["items"] = [],
  previews: CollectionDetail["previews"] = [],
): CollectionDetail {
  return {
    collection: {
      bannerAssetId: null,
      coverAssetId: null,
      createdAt: at,
      description: "",
      id: id(),
      name: "First light",
      plannedSupply: 5,
      provenance: "",
      revision: 1,
      targetChain: signet,
      updatedAt: at,
      ...collection,
    },
    items,
    previews,
  };
}

// A processed library asset with a thumbnail, as the uploads library presents it.
export function imageAsset(
  purpose: LibraryAsset["purpose"],
  assetId = id(),
  overrides: Partial<LibraryAsset> = {},
): LibraryAsset {
  return libraryAssetFixture(purpose, assetId, overrides);
}
