import type { ApprovedVersionReader } from "@ador/collections";
import type { ChainOption } from "@ador/shared/chain";
import { uuidV7Schema, type UuidV7 } from "@ador/shared/identifiers";
import type { LibraryAsset } from "@ador/shared/uploads";

import {
  presentCard,
  presentCollection,
  type PublicCard,
  type PublicCollection,
} from "./public-model.ts";

// The previews of one creator's assets, as the uploads library presents them (state and short-lived
// signed renditions, ADR-016). Only assets frozen into an approved version are ever asked for.
export interface PreviewSource {
  getMany(
    ownerUserId: UuidV7,
    assetIds: readonly UuidV7[],
  ): Promise<readonly LibraryAsset[]>;
}

export interface CatalogDependencies {
  readonly chains: readonly ChainOption[];
  readonly listLimit: number;
  readonly previews: PreviewSource;
  readonly reader: ApprovedVersionReader;
}

// The public catalog: approved collections only, each as the frozen version that was approved, with
// the creator's images signed for display. It owns the allowlist (`public-model.ts`) and nothing else.
export function createPublicCatalog(dependencies: CatalogDependencies) {
  const { chains, previews, reader } = dependencies;

  return {
    async detail(collectionId: UuidV7): Promise<PublicCollection | null> {
      const version = await reader.findApprovedVersion(collectionId);
      if (version === null) return null;
      const ids = version.snapshot.assets.map(({ id }) =>
        uuidV7Schema.parse(id),
      );
      const signed =
        ids.length === 0
          ? []
          : await previews.getMany(version.ownerUserId, ids);
      return presentCollection(version, signed, chains);
    },

    async index(): Promise<readonly PublicCard[]> {
      const summaries = await reader.listApprovedCollections(
        dependencies.listLimit,
      );
      // One signing call per cover, as its creator's own asset: a card never needs more.
      return Promise.all(
        summaries.map(async (summary) =>
          presentCard(
            summary,
            summary.coverAssetId === null
              ? []
              : await previews.getMany(summary.ownerUserId, [
                  uuidV7Schema.parse(summary.coverAssetId),
                ]),
            chains,
          ),
        ),
      );
    },
  };
}

export type PublicCatalog = ReturnType<typeof createPublicCatalog>;
