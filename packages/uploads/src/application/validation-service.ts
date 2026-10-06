import { mediaValidatorVersion, validateImage } from "@ador/media";
import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { uuidV7Schema } from "@ador/shared/identifiers";
import type { UploadPolicy } from "@ador/shared/uploads";

import { readUpTo } from "./bounded-read.ts";
import type {
  AssetValidationOutcome,
  AssetValidationRepository,
  AssetValidationSubject,
} from "./validation-repository.ts";

export type AssetValidationResult =
  | { readonly kind: "unavailable" }
  | { readonly kind: "provider-mismatch" }
  | {
      readonly kind: "recorded" | "replayed";
      readonly outcome: AssetValidationOutcome;
    };

const rejected = (
  reason: Extract<AssetValidationOutcome, { state: "rejected" }>["reason"],
): AssetValidationOutcome => ({
  reason,
  state: "rejected",
  validatorVersion: mediaValidatorVersion,
});

export function createAssetValidationService(dependencies: {
  readonly clock: () => Date;
  readonly policy: UploadPolicy;
  readonly repository: AssetValidationRepository;
  readonly storage: ObjectStoragePort;
}) {
  const { clock, policy, repository, storage } = dependencies;

  // Storage and stream failures throw before any state change, leaving the asset retryable.
  async function inspect(
    subject: AssetValidationSubject,
  ): Promise<AssetValidationOutcome> {
    if (subject.declaredByteLength > policy.maxBytesByPurpose[subject.purpose])
      return rejected("size-exceeded");
    const stored = await storage.read({
      key: subject.objectKey,
      scope: "private",
    });
    if (stored.contentLength !== subject.declaredByteLength) {
      stored.body.destroy();
      return rejected("byte-length-mismatch");
    }
    const bytes = await readUpTo(stored.body, subject.declaredByteLength);
    if (bytes === null || bytes.length !== subject.declaredByteLength)
      return rejected("byte-length-mismatch");
    const result = validateImage({
      bytes,
      declaredMediaType: subject.declaredContentType,
      limits: {
        maxDimension: policy.maxImageDimension,
        maxPixels: policy.maxImagePixels,
      },
    });
    return result.ok
      ? {
          contentSha256: result.sha256,
          contentType: result.mediaType,
          entityTag: stored.entityTag,
          height: result.height,
          state: "validated",
          validatorVersion: mediaValidatorVersion,
          width: result.width,
        }
      : rejected(result.reason);
  }

  return {
    async validate(input: {
      readonly assetId: string;
    }): Promise<AssetValidationResult> {
      const assetId = uuidV7Schema.safeParse(input.assetId);
      if (!assetId.success) return { kind: "unavailable" };
      const lookup = await repository.find(assetId.data);
      if (lookup.kind === "missing") return { kind: "unavailable" };
      if (lookup.kind === "final")
        return { kind: "replayed", outcome: lookup.outcome };
      if (lookup.subject.storageProviderId !== storage.providerId)
        return { kind: "provider-mismatch" };
      const outcome = await inspect(lookup.subject);
      return repository.record({
        assetId: assetId.data,
        completedAt: clock(),
        outcome,
      });
    },
  };
}
