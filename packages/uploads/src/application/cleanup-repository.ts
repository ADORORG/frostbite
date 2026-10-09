import type { ObjectKey } from "@ador/object-storage/contracts";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { ProviderId } from "@ador/shared/providers";

// An upload that was never completed and whose cleanup time has passed. Its private object, if the
// browser ever wrote one, is what remains to be removed.
export interface AbandonedUpload {
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
  // Only intents written through `storageProviderId` are claimed: another provider's objects cannot
  // be removed from here, and claiming them would crowd out work that can be done.
  claim(input: {
    readonly limit: number;
    readonly now: Date;
    readonly storageProviderId: ProviderId;
  }): Promise<readonly AbandonedUpload[]>;
  // Records that the object is gone, so later passes skip the intent. Idempotent.
  markObjectRemoved(input: {
    readonly intentId: UuidV7;
    readonly removedAt: Date;
  }): Promise<void>;
}
