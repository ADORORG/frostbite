import {
  createDatabaseFromEnvironment,
  type DatabaseClient,
} from "@ador/database/connection";
import type { ObjectStorageProviderServices } from "@ador/object-storage";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";

type Storage = ObjectStorageProviderServices["object-storage:s3-compatible"];

export interface CollectionStudioContext {
  readonly database: DatabaseClient;
  readonly storage: Storage;
}

// Resolves the feature's shared dependencies once, on first use, so every operation shares one
// connection pool and one storage service. A failed resolution is not cached.
export function createCollectionStudioContextResolver(
  providers: ProviderRegistry,
  environment: NodeJS.ProcessEnv = process.env,
): () => Promise<CollectionStudioContext> {
  return memoizeUntilFailure(async () => ({
    database: createDatabaseFromEnvironment(environment),
    storage: await providers.resolve("object-storage:s3-compatible"),
  }));
}
