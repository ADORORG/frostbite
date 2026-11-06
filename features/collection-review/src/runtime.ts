import {
  createDrizzleSubmissionRepository,
  createReviewService,
} from "@frostbite/collections";
import type { UploadsContext } from "@frostbite/feature-uploads/context";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import type { AuthorizationPolicy } from "@frostbite/shared/accounts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import {
  createAssetLibraryService,
  createDrizzleAssetLibraryRepository,
} from "@frostbite/uploads";

// Events on one page of the activity log; an engineering bound, not a product quota.
const activityLimit = 50;

// Submissions waiting at once on the queue page; an engineering bound, not a product quota.
const queueLimit = 100;

type ResolveContext = () => Promise<UploadsContext>;

// The review service, built on first use over the shared database client. A failed build is not cached.
export function createReviewServiceResolver(
  authorizationPolicy: AuthorizationPolicy,
  resolveContext: ResolveContext,
) {
  return memoizeUntilFailure(async () => {
    const { database } = await resolveContext();
    return createReviewService({
      activityLimit,
      authorizationPolicy,
      clock: () => new Date(),
      createId: createUuidV7,
      queueLimit,
      repository: createDrizzleSubmissionRepository(database),
    });
  });
}

// Previews of a submission's images for the reviewer: the uploads library's own presentation (state and
// short-lived signed renditions, ADR-016), so signing stays in one place.
export function createPreviewResolver(resolveContext: ResolveContext) {
  return memoizeUntilFailure(async () => {
    const { database, storage } = await resolveContext();
    return createAssetLibraryService({
      repository: createDrizzleAssetLibraryRepository(database),
      storage,
    });
  });
}
