import {
  createDatabaseClient,
  type DatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import type { AssetPipelineActivities } from "@ador/jobs/activities";
import type { MediaProcessingProviderServices } from "@ador/media/processing";
import type { ObjectStorageProviderServices } from "@ador/object-storage";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import { createUuidV7 } from "@ador/shared/identifiers";
import {
  resolveDerivativePolicy,
  resolveUploadPolicy,
} from "@ador/shared/uploads";
import {
  createAssetPipelineActivities,
  createAssetProcessingService,
  createAssetValidationService,
  createDrizzleAssetProcessingRepository,
  createDrizzleAssetValidationRepository,
} from "@ador/uploads";

import { systemClock } from "./clock.ts";
import { memoizeUntilFailure } from "./lazy.ts";

export interface AssetPipelineOptions {
  readonly clock?: () => Date;
  // Reuse the host's client (and so its pool); by default one is created from the environment.
  readonly database?: DatabaseClient;
}

async function build(
  providers: ProviderRegistry,
  options: AssetPipelineOptions,
): Promise<AssetPipelineActivities> {
  const clock = options.clock ?? systemClock;
  type Storage = ObjectStorageProviderServices["object-storage:s3-compatible"];
  type Processor =
    MediaProcessingProviderServices["media-processing:image-derivatives"];
  const [storage, processor]: [Storage, Processor] = await Promise.all([
    providers.resolve("object-storage:s3-compatible"),
    providers.resolve("media-processing:image-derivatives"),
  ]);
  const database =
    options.database ??
    createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(process.env)),
    );
  const uploadPolicy = resolveUploadPolicy();
  return createAssetPipelineActivities({
    processing: createAssetProcessingService({
      clock,
      createId: createUuidV7,
      derivativePolicy: resolveDerivativePolicy(),
      processor,
      repository: createDrizzleAssetProcessingRepository(database),
      storage,
      uploadPolicy,
    }),
    validation: createAssetValidationService({
      clock,
      policy: uploadPolicy,
      repository: createDrizzleAssetValidationRepository(database),
      storage,
    }),
  });
}

// Composes the validation and processing activities from the typed provider capabilities, so the
// workflow provider receives only provider-neutral activities. A failed composition (missing
// configuration, unavailable provider) is not cached, so a later call can succeed.
export function createAssetPipelineResolver(
  providers: ProviderRegistry,
  options: AssetPipelineOptions = {},
): () => Promise<AssetPipelineActivities> {
  return memoizeUntilFailure(() => build(providers, options));
}
