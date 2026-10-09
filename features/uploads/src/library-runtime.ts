import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@ador/uploads";

import type { UploadsContext } from "./context.ts";
import { memoizeUntilFailure } from "./lazy.ts";

export function createLibraryServiceResolver(
  resolveContext: () => Promise<UploadsContext>,
) {
  return memoizeUntilFailure(async () => {
    const { database, storage } = await resolveContext();
    return createAssetLibraryService({
      repository: createDrizzleAssetLibraryRepository(database),
      storage,
    });
  });
}
