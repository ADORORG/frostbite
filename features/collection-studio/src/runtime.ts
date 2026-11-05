import {
  createCollectionService,
  createDrizzleCollectionRepository,
  createDrizzleSubmissionRepository,
  createSubmissionService,
} from "@frostbite/collections";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import type { ChainOption } from "@frostbite/shared/chain";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@frostbite/uploads";

import type { UploadsContext } from "@frostbite/feature-uploads/context";

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
