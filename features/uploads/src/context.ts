import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  type DatabaseClient,
} from "@ador/database/connection";
import type { ObjectStorageProviderServices } from "@ador/object-storage";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";

type Storage = ObjectStorageProviderServices["object-storage:s3-compatible"];

export interface UploadsContext {
  readonly database: DatabaseClient;
  readonly storage: Storage;
}

// Resolves the feature's shared dependencies once, on first use, so every upload operation shares one
// storage service and one connection pool. A failed resolution is not cached.
export function createUploadsContextResolver(
  providers: ProviderRegistry,
  environment: NodeJS.ProcessEnv = process.env,
): () => Promise<UploadsContext> {
  let context: Promise<UploadsContext> | undefined;
  return () => {
    context ??= providers
      .resolve("object-storage:s3-compatible")
      .then((storage: Storage) => ({
        database: createDatabaseClient(
          createDatabasePool(parseDatabaseEnvironment(environment)),
        ),
        storage,
      }))
      .catch((error: Error) => {
        context = undefined;
        throw error;
      });
    return context;
  };
}
