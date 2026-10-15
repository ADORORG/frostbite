import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { UploadPolicy } from "@ador/shared/uploads";

import type {
  AbandonedUpload,
  UploadCleanupRepository,
} from "./cleanup-repository.ts";

export interface UploadCleanupFailure {
  readonly intentId: UuidV7;
  readonly message: string;
}

export interface UploadCleanupResult {
  readonly claimed: number;
  // Storage refused, failed or took too long. The intent stays abandoned with removal outstanding and is tried again after a
  // wait that grows with each failure.
  readonly failures: readonly UploadCleanupFailure[];
  readonly removed: number;
}

class RemovalTimedOut extends Error {
  constructor() {
    super("Removal timed out.");
  }
}

// Removes the private objects of abandoned uploads (accepted W3-02 policy: unclaimed objects become
// eligible after the cleanup delay). It only ever touches intents the repository has claimed as
// abandoned, never an object an asset refers to. Removals run a few at a time, each with a time limit, and one that fails
// is put off for a wait that doubles with each failure, so a slow or poisoned key cannot hold up or crowd out the rest.
export function createUploadCleanupService(dependencies: {
  readonly clock: () => Date;
  readonly policy: Pick<
    UploadPolicy,
    | "cleanupBatchSize"
    | "cleanupConcurrency"
    | "cleanupDeleteTimeoutMs"
    | "cleanupRetryBaseMs"
    | "cleanupRetryMaxMs"
  >;
  readonly repository: UploadCleanupRepository;
  readonly storage: ObjectStoragePort;
}) {
  const { clock, policy, repository, storage } = dependencies;

  // Deleting a key that was never written is a no-op, so an upload the browser never started needs no special case.
  async function remove(upload: AbandonedUpload): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        storage.delete({ key: upload.objectKey, scope: "private" }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new RemovalTimedOut()),
            policy.cleanupDeleteTimeoutMs,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    await repository.markObjectRemoved({
      intentId: upload.intentId,
      removedAt: clock(),
    });
  }

  // The wait before the next try: the base, doubled for each earlier failure, up to the maximum.
  const waitAfter = (attempts: number): number =>
    Math.min(
      policy.cleanupRetryBaseMs * 2 ** Math.min(attempts, 30),
      policy.cleanupRetryMaxMs,
    );

  return {
    async sweep(): Promise<UploadCleanupResult> {
      const claimed = await repository.claim({
        limit: policy.cleanupBatchSize,
        now: clock(),
        storageProviderId: storage.providerId,
      });
      const failures: UploadCleanupFailure[] = [];
      let removed = 0;
      const queue = [...claimed];
      const worker = async (): Promise<void> => {
        for (let upload = queue.shift(); upload; upload = queue.shift()) {
          try {
            await remove(upload);
            removed += 1;
          } catch (error) {
            failures.push({
              intentId: upload.intentId,
              message:
                error instanceof Error ? error.message : "Removal failed.",
            });
            // Putting the retry off is best effort: if it cannot be recorded, the intent is simply tried again next pass.
            await repository
              .recordFailure({
                intentId: upload.intentId,
                retryAt: new Date(
                  clock().getTime() + waitAfter(upload.attempts),
                ),
              })
              .catch(() => undefined);
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(policy.cleanupConcurrency, claimed.length) },
          worker,
        ),
      );
      return { claimed: claimed.length, failures, removed };
    },
  };
}

export type UploadCleanupService = ReturnType<
  typeof createUploadCleanupService
>;
