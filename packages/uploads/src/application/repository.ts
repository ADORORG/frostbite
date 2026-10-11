import type { UploadContentType, UploadPurpose } from "@ador/shared/uploads";
import type { IdempotencyKey } from "@ador/shared/http";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { ObjectKey } from "@ador/object-storage/contracts";
import type { DomainEventEnvelope } from "@ador/events";
import type { ProviderId } from "@ador/shared/providers";
import type { AssetProcessingState } from "@ador/shared/uploads";

export interface UploadIntentView {
  readonly byteLength: number;
  readonly contentType: UploadContentType;
  readonly expiresAt: Date;
  readonly id: UuidV7;
  readonly objectKey: ObjectKey;
  readonly purpose: UploadPurpose;
  readonly storageProviderId: ProviderId;
}

export interface CompletedAssetView {
  readonly id: UuidV7;
  readonly processingState: AssetProcessingState;
}

export type UploadCompletionPreparation =
  | { readonly asset: CompletedAssetView; readonly kind: "completed" }
  | { readonly intent: UploadIntentView; readonly kind: "ready" }
  | { readonly kind: "unavailable" };

export type CompleteUploadResult =
  | {
      readonly asset: CompletedAssetView;
      readonly kind: "completed" | "replayed";
    }
  | { readonly kind: "unavailable" };

export type ReserveUploadIntentResult =
  | {
      readonly intent: UploadIntentView;
      readonly kind: "reserved" | "replayed";
    }
  | { readonly kind: "conflict" }
  | { readonly kind: "quota-exceeded" };

export interface UploadIntentRepository {
  complete(input: {
    readonly assetId: UuidV7;
    readonly completedAt: Date;
    readonly event: DomainEventEnvelope;
    readonly intentId: UuidV7;
    readonly object: {
      readonly contentLength: number;
      readonly contentType: string;
      readonly entityTag: string;
      readonly lastModified: Date;
      readonly providerId: ProviderId;
    };
    readonly userId: UuidV7;
  }): Promise<CompleteUploadResult>;
  findForCompletion(input: {
    readonly intentId: UuidV7;
    readonly now: Date;
    readonly userId: UuidV7;
  }): Promise<UploadCompletionPreparation>;
  markSigningFailed(input: {
    readonly failedAt: Date;
    readonly intentId: UuidV7;
    readonly userId: UuidV7;
  }): Promise<void>;
  reserve(
    input: UploadIntentView & {
      readonly activeLimit: number;
      readonly cleanupEligibleAt: Date;
      readonly createdAt: Date;
      readonly fileName?: string;
      readonly idempotencyKey: IdempotencyKey;
      readonly requestFingerprint: string;
      readonly retainUntil: Date;
      readonly userId: UuidV7;
    },
  ): Promise<ReserveUploadIntentResult>;
}
