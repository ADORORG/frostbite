import type { ObjectKey } from "@frostbite/object-storage/contracts";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { ProviderId } from "@frostbite/shared/providers";

// An upload that was never completed and whose cleanup time has passed. Its private object, if the
// browser ever wrote one, is what remains to be removed.
export interface AbandonedUpload {
  // How many earlier removals failed; the service backs off by it.
  readonly attempts: number;
  readonly intentId: UuidV7;
  readonly objectKey: ObjectKey;
}

export interface UploadCleanupRepository {
  // Atomically marks intents that are past their cleanup time and were never completed as
  // `abandoned`, then returns them together with abandoned intents whose object removal was never
  // recorded (a crash or storage outage on an earlier pass). Oldest first, at most `limit`. A claimed
  // intent can no longer be completed or re-reserved, so deleting its object cannot race a user.
  // Passes running at the same time never lose an intent; one that sees another's removal still
  // pending may return it too, which is harmless because deleting and recording are idempotent.
  // An intent whose removal failed is not returned again until its retry time (see `recordFailure`), so one that always
  // fails does not take a place in every pass.
  // Only intents written through `storageProviderId` are claimed: another provider's objects cannot
  // be removed from here, and claiming them would crowd out work that can be done.
  claim(input: {
    readonly limit: number;
    readonly now: Date;
    readonly storageProviderId: ProviderId;
  }): Promise<readonly AbandonedUpload[]>;
  // Records that removing the object failed: one more attempt, and no new try before `retryAt`. Idempotent per call.
  recordFailure(input: {
    readonly intentId: UuidV7;
    readonly retryAt: Date;
  }): Promise<void>;
  // Records that the object is gone, so later passes skip the intent. Idempotent.
  markObjectRemoved(input: {
    readonly intentId: UuidV7;
    readonly removedAt: Date;
  }): Promise<void>;
}
