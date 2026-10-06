import type { Readable } from "node:stream";

import { mediaValidatorVersion, validateImage } from "@ador/media";
import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { ObjectStorageError } from "@ador/object-storage/errors";
import { uuidV7Schema } from "@ador/shared/identifiers";
import type { UploadPolicy } from "@ador/shared/uploads";

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

// Buffers at most `limit` bytes, so memory is bounded by the declared size. Returns null as soon
// as the object proves larger; the stream is always destroyed.
async function readUpTo(
  body: Readable,
  limit: number,
): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for await (const chunk of body) {
      if (!(chunk instanceof Uint8Array)) {
        throw new ObjectStorageError(
          "invalid-provider-response",
          "Object body produced a non-binary chunk.",
        );
      }
      total += chunk.length;
      if (total > limit) return null;
      chunks.push(chunk);
    }
  } finally {
    body.destroy();
  }
  return Buffer.concat(chunks);
}

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
