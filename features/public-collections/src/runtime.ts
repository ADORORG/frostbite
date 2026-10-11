import { createDrizzleApprovedVersionReader } from "@ador/collections";
import type { UploadsContext } from "@ador/feature-uploads/context";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import type { ChainOption } from "@ador/shared/chain";
import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@ador/uploads";

import { createPublicCatalog } from "./application/catalog.ts";

// Collections shown on the index at once; an engineering bound, not a product quota.
const listLimit = 60;

// The catalog, built on first use over the shared database client and storage. A failed build is not cached.
export function createCatalogResolver(
  resolveContext: () => Promise<UploadsContext>,
  chains: readonly ChainOption[],
) {
  return memoizeUntilFailure(async () => {
    const { database, storage } = await resolveContext();
    return createPublicCatalog({
      chains,
      listLimit,
      previews: createAssetLibraryService({
        repository: createDrizzleAssetLibraryRepository(database),
        storage,
      }),
      reader: createDrizzleApprovedVersionReader(database),
    });
  });
}
