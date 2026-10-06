import type { ObjectKey } from "@ador/object-storage/contracts";
import type { UuidV7 } from "@ador/shared/identifiers";
import type { ProviderId } from "@ador/shared/providers";
import type {
  AssetProcessingState,
  AssetRejectionReason,
  DerivativeKind,
  UploadContentType,
} from "@ador/shared/uploads";

// A validated asset waiting for derivatives: the bytes must still hash to `contentSha256`.
export interface AssetProcessingSubject {
  readonly assetId: UuidV7;
  readonly byteLength: number;
  readonly contentSha256: string;
  readonly height: number;
  readonly objectKey: ObjectKey;
  readonly storageProviderId: ProviderId;
  readonly width: number;
}

export interface StoredDerivative {
  readonly byteLength: number;
  readonly contentSha256: string;
  readonly contentType: UploadContentType;
  readonly height: number;
  readonly kind: DerivativeKind;
  readonly objectKey: ObjectKey;
  readonly specVersion: string;
  readonly storageProviderId: ProviderId;
  readonly width: number;
}

export type AssetProcessingOutcome =
  | {
      readonly derivatives: readonly StoredDerivative[];
      readonly state: "processed";
    }
  | { readonly reason: AssetRejectionReason; readonly state: "unprocessable" };

export type AssetProcessingLookup =
  | { readonly kind: "missing" }
  // Not yet validated, or rejected by validation: there is nothing to process.
  | { readonly kind: "not-ready"; readonly state: AssetProcessingState }
  | { readonly kind: "pending"; readonly subject: AssetProcessingSubject }
  | { readonly kind: "final"; readonly outcome: AssetProcessingOutcome };

export interface AssetProcessingRecording {
  readonly kind: "recorded" | "replayed";
  readonly outcome: AssetProcessingOutcome;
}

export interface AssetProcessingRepository {
  find(assetId: UuidV7): Promise<AssetProcessingLookup>;
  // Conditionally moves a `validated` asset to its terminal processing state, together with its
  // derivative rows, in one transaction. A repeated or concurrent call returns the winner.
  record(input: {
    readonly assetId: UuidV7;
    readonly completedAt: Date;
    readonly createId: () => UuidV7;
    readonly outcome: AssetProcessingOutcome;
  }): Promise<AssetProcessingRecording>;
}
