import type { UploadCleanupResult } from "@frostbite/feature-uploads/cleanup";

export interface CleanupPassDependencies {
  // Called for every pass that found abandoned uploads, with what became of them.
  readonly onResult: (result: UploadCleanupResult) => void;
  // Resolved on every pass, so a provider that is unavailable now can recover later.
  readonly sweep: () => Promise<() => Promise<UploadCleanupResult>>;
}

// One cleanup pass for the drain loop. Progress is what was removed, not what was claimed: uploads
// whose removal keeps failing are retried after the idle delay instead of in a tight loop against a
// store that is failing.
export function createCleanupPass(
  dependencies: CleanupPassDependencies,
): () => Promise<number> {
  return async () => {
    const result = await (await dependencies.sweep())();
    if (result.claimed > 0) dependencies.onResult(result);
    return result.removed;
  };
}
