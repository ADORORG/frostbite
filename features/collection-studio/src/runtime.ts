import {
  createCollectionService,
  createDrizzleCollectionRepository,
  createDrizzleSubmissionRepository,
  createSubmissionService,
} from "@ador/collections";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import type { ChainOption } from "@ador/shared/chain";
import { createUuidV7 } from "@ador/shared/identifiers";
import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@ador/uploads";

import type { UploadsContext } from "@ador/feature-uploads/context";

// A creator's own drafts listed at once; engineering bound, not a product quota.
const draftListLimit = 100;

export function createCollectionServiceResolver(
  resolveContext: () => Promise<UploadsContext>,
  targetChains: readonly ChainOption[],
) {
  return memoizeUntilFailure(async () => {
    const { database } = await resolveContext();
    return createCollectionService({
      clock: () => new Date(),
      createId: createUuidV7,
      listLimit: draftListLimit,
      repository: createDrizzleCollectionRepository(database),
      targetChains,
    });
  });
}

export function createSubmissionServiceResolver(
  resolveContext: () => Promise<UploadsContext>,
  targetChains: readonly ChainOption[],
) {
  return memoizeUntilFailure(async () => {
    const { database } = await resolveContext();
    return createSubmissionService({
      clock: () => new Date(),
      createId: createUuidV7,
      repository: createDrizzleSubmissionRepository(database),
      targetChains,
    });
  });
}

// The previews are the uploads library's own presentation of the creator's assets (state and
// short-lived signed renditions, ADR-016), so signing stays in one place.
export function createAssetPreviewResolver(
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
