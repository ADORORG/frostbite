import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  type DatabaseClient,
} from "@ador/database/connection";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import { resolveUploadPolicy } from "@ador/shared/uploads";
import {
  createDrizzleUploadCleanupRepository,
  createUploadCleanupService,
  type UploadCleanupService,
} from "@ador/uploads";

import { systemClock } from "./clock.ts";
import { memoizeUntilFailure } from "./lazy.ts";

export type { UploadCleanupResult } from "@ador/uploads";

export interface UploadCleanupOptions {
  readonly clock?: () => Date;
  // Reuse the host's client (and so its pool); by default one is created from the environment.
  readonly database?: DatabaseClient;
}

// Composes the abandoned-upload cleanup from the typed object-storage capability. A failed
// composition (missing configuration, unavailable provider) is not cached, so a later pass can succeed.
export function createUploadCleanupResolver(
  providers: ProviderRegistry,
  options: UploadCleanupOptions = {},
): () => Promise<UploadCleanupService> {
  return memoizeUntilFailure(async () => {
    const storage = await providers.resolve("object-storage:s3-compatible");
    const database =
      options.database ??
      createDatabaseClient(
        createDatabasePool(parseDatabaseEnvironment(process.env)),
      );
    return createUploadCleanupService({
      clock: options.clock ?? systemClock,
      policy: resolveUploadPolicy(),
      repository: createDrizzleUploadCleanupRepository(database),
      storage,
    });
  });
}
