import { createHash } from "node:crypto";

import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { parseObjectKey } from "@ador/object-storage/contracts";
import type { CorrelationId, IdempotencyKey } from "@ador/shared/http";
import { uuidV7Schema, type UuidV7 } from "@ador/shared/identifiers";
import {
  createUploadIntentInputSchema,
  completeUploadIntentInputSchema,
  assetProcessingRequestedEvent,
  type AssetProcessingState,
  type CompleteUploadIntentInput,
  resolveUploadPolicy,
  type CreateUploadIntentInput,
  type UploadPolicyOverrides,
} from "@ador/shared/uploads";

import type { UploadIntentRepository } from "./repository.ts";

export type CreateIntentResult =
  | {
      readonly intent: {
        readonly byteLength: number;
        readonly contentType: CreateUploadIntentInput["contentType"];
        readonly expiresAt: Date;
        readonly id: UuidV7;
        readonly purpose: CreateUploadIntentInput["purpose"];
      };
      readonly kind: "created";
      readonly upload: Awaited<
        ReturnType<ObjectStoragePort["presignPrivateUpload"]>
      >;
    }
  | { readonly kind: "conflict" }
  | { readonly kind: "invalid-size" }
  | { readonly kind: "quota-exceeded" };

export type CompleteIntentResult =
  | {
      readonly asset: {
        readonly id: UuidV7;
        readonly processingState: AssetProcessingState;
      };
      readonly kind: "completed" | "replayed";
    }
  | { readonly kind: "invalid-object" }
  | { readonly kind: "missing-object" }
  | { readonly kind: "unavailable" };

// Seconds shaved off a signed credential's lifetime so provider-side clock reads never push its expiry
// past the persisted authorization expiry.
const credentialExpiryMarginSeconds = 1;

export function createUploadIntentService(dependencies: {
  readonly clock: () => Date;
  readonly createDraftKey: () => string;
  readonly createId: () => UuidV7;
  readonly policy?: UploadPolicyOverrides;
  readonly repository: UploadIntentRepository;
  readonly storage: ObjectStoragePort;
}) {
  const policy = resolveUploadPolicy(dependencies.policy);
  return {
    async complete(
      unvalidatedInput: CompleteUploadIntentInput,
      context: {
        readonly correlationId: CorrelationId;
        readonly userId: UuidV7;
      },
    ): Promise<CompleteIntentResult> {
      const input = completeUploadIntentInputSchema.parse(unvalidatedInput);
      const intentId = uuidV7Schema.parse(input.intentId);
      const completedAt = dependencies.clock();
      const preparation = await dependencies.repository.findForCompletion({
        intentId,
        now: completedAt,
        userId: context.userId,
      });
      if (preparation.kind === "completed") {
        return { asset: preparation.asset, kind: "replayed" };
      }
      if (preparation.kind === "unavailable") return preparation;
      if (
        preparation.intent.storageProviderId !== dependencies.storage.providerId
      )
        return { kind: "unavailable" };
      const object = await dependencies.storage.head({
        key: preparation.intent.objectKey,
        scope: "private",
      });
      if (object === null) return { kind: "missing-object" };
      if (
        object.contentLength !== preparation.intent.byteLength ||
        !Number.isSafeInteger(object.contentLength) ||
        object.contentLength < 1 ||
        object.contentType.trim().length === 0 ||
        object.entityTag.trim().length === 0 ||
        !Number.isFinite(object.lastModified.getTime())
      ) {
        return { kind: "invalid-object" };
      }
      const assetId = dependencies.createId();
      const eventId = dependencies.createId();
      return dependencies.repository.complete({
        assetId,
        completedAt,
        event: {
          causationId: null,
          correlationId: context.correlationId,
          eventId,
          name: assetProcessingRequestedEvent.name,
          occurredAt: completedAt.toISOString(),
          payload: { assetId, uploadIntentId: intentId },
          schemaVersion: assetProcessingRequestedEvent.schemaVersion,
        },
        intentId,
        object: { ...object, providerId: dependencies.storage.providerId },
        userId: context.userId,
      });
    },
    async create(
      unvalidatedInput: CreateUploadIntentInput,
      context: {
        readonly idempotencyKey: IdempotencyKey;
        readonly userId: UuidV7;
      },
    ): Promise<CreateIntentResult> {
      const input = createUploadIntentInputSchema.parse(unvalidatedInput);
      if (input.byteLength > policy.maxBytesByPurpose[input.purpose]) {
        return { kind: "invalid-size" };
      }
      const createdAt = dependencies.clock();
      const expiresAt = new Date(
        createdAt.getTime() + policy.presignedUrlLifetimeMs,
      );
      const intentId = dependencies.createId();
      const objectKey = parseObjectKey(
        `drafts/${dependencies.createDraftKey()}`,
      );
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      const reserved = await dependencies.repository.reserve({
        ...input,
        activeLimit: policy.activeIntentLimitPerUser,
        cleanupEligibleAt: new Date(
          createdAt.getTime() + policy.cleanupDelayMs,
        ),
        createdAt,
        expiresAt,
        id: intentId,
        idempotencyKey: context.idempotencyKey,
        objectKey,
        requestFingerprint: fingerprint,
        retainUntil: new Date(createdAt.getTime() + policy.intentRetentionMs),
        storageProviderId: dependencies.storage.providerId,
        userId: context.userId,
      });
      if (reserved.kind === "conflict" || reserved.kind === "quota-exceeded") {
        return reserved;
      }
      if (reserved.intent.storageProviderId !== dependencies.storage.providerId)
        return { kind: "conflict" };
      // The provider stamps its own, slightly later, issue time, so signing for the whole remaining
      // lifetime would outlive the persisted authorization by the time it took to get here. Measure
      // from now and keep a margin that covers that delay.
      const remainingLifetimeSeconds =
        Math.floor(
          (reserved.intent.expiresAt.getTime() -
            dependencies.clock().getTime()) /
            1_000,
        ) - credentialExpiryMarginSeconds;
      if (remainingLifetimeSeconds < 1) return { kind: "conflict" };
      try {
        const upload = await dependencies.storage.presignPrivateUpload({
          contentLength: reserved.intent.byteLength,
          contentType: reserved.intent.contentType,
          expiresInSeconds: remainingLifetimeSeconds,
          key: reserved.intent.objectKey,
        });
        if (
          !Number.isFinite(upload.expiresAt.getTime()) ||
          upload.expiresAt > reserved.intent.expiresAt
        ) {
          throw new Error(
            "Upload credential exceeds its persisted authorization expiry.",
          );
        }
        return {
          intent: {
            byteLength: reserved.intent.byteLength,
            contentType: reserved.intent.contentType,
            expiresAt: reserved.intent.expiresAt,
            id: reserved.intent.id,
            purpose: reserved.intent.purpose,
          },
          kind: "created",
          upload,
        };
      } catch (error) {
        await dependencies.repository.markSigningFailed({
          failedAt: dependencies.clock(),
          intentId: reserved.intent.id,
          userId: context.userId,
        });
        throw error;
      }
    },
  };
}
