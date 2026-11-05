import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@frostbite/uploads";

import type { UploadsContext } from "./context.ts";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";

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
