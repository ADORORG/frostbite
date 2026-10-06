import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@ador/uploads";

import type { UploadsContext } from "./context.ts";

export function createLibraryServiceResolver(
  resolveContext: () => Promise<UploadsContext>,
) {
  let service:
    Promise<ReturnType<typeof createAssetLibraryService>> | undefined;
  return () => {
    service ??= resolveContext()
      .then(({ database, storage }) =>
        createAssetLibraryService({
          repository: createDrizzleAssetLibraryRepository(database),
          storage,
        }),
      )
      .catch((error: Error) => {
        service = undefined;
        throw error;
      });
    return service;
  };
}
