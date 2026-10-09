import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { UploadPolicy } from "@ador/shared/uploads";

import type { UploadCleanupRepository } from "./cleanup-repository.ts";

export interface UploadCleanupFailure {
  readonly intentId: UuidV7;
  readonly message: string;
}

export interface UploadCleanupResult {
  readonly claimed: number;
  // Storage refused or failed; the intent stays abandoned with removal outstanding, so the next pass
  // retries it.
  readonly failures: readonly UploadCleanupFailure[];
  readonly removed: number;
}

// Removes the private objects of abandoned uploads (accepted W3-02 policy: unclaimed objects become
// eligible after the cleanup delay). It only ever touches intents the repository has claimed as
// abandoned, never an object an asset refers to.
export function createUploadCleanupService(dependencies: {
  readonly clock: () => Date;
  readonly policy: Pick<UploadPolicy, "cleanupBatchSize">;
  readonly repository: UploadCleanupRepository;
  readonly storage: ObjectStoragePort;
}) {
  const { clock, policy, repository, storage } = dependencies;
  return {
    async sweep(): Promise<UploadCleanupResult> {
      const claimed = await repository.claim({
        limit: policy.cleanupBatchSize,
        now: clock(),
        storageProviderId: storage.providerId,
      });
      const failures: UploadCleanupFailure[] = [];
      let removed = 0;
      for (const upload of claimed) {
        try {
          // Deleting a key that was never written is a no-op, so an upload the browser never
          // started needs no special case.
          await storage.delete({ key: upload.objectKey, scope: "private" });
          await repository.markObjectRemoved({
            intentId: upload.intentId,
            removedAt: clock(),
          });
          removed += 1;
        } catch (error) {
          failures.push({
            intentId: upload.intentId,
            message: error instanceof Error ? error.message : "Removal failed.",
          });
        }
      }
      return { claimed: claimed.length, failures, removed };
    },
  };
}

export type UploadCleanupService = ReturnType<
  typeof createUploadCleanupService
>;
