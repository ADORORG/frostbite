import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@ador/uploads";

import type { UploadsContext } from "./context.ts";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";

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
