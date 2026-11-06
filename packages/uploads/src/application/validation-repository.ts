import type { ObjectKey } from "@frostbite/object-storage/contracts";
import type { UuidV7 } from "@frostbite/shared/identifiers";
import type { ProviderId } from "@frostbite/shared/providers";
import type {
  AssetRejectionReason,
  UploadContentType,
  UploadPurpose,
} from "@frostbite/shared/uploads";

export interface AssetValidationSubject {
  readonly assetId: UuidV7;
  readonly declaredByteLength: number;
  readonly declaredContentType: UploadContentType;
  readonly objectKey: ObjectKey;
  readonly purpose: UploadPurpose;
  readonly storageProviderId: ProviderId;
}

// Terminal results of byte validation. `entityTag` pins the exact object version whose bytes were
// hashed so later publication can refuse a replaced object.
export type AssetValidationOutcome =
  | {
      readonly contentSha256: string;
      readonly contentType: UploadContentType;
      readonly entityTag: string;
      readonly height: number;
      readonly state: "validated";
      readonly validatorVersion: string;
      readonly width: number;
    }
  | {
      readonly reason: AssetRejectionReason;
      readonly state: "rejected";
      readonly validatorVersion: string;
    };

export type AssetValidationLookup =
  | { readonly kind: "missing" }
  | { readonly kind: "pending"; readonly subject: AssetValidationSubject }
  | { readonly kind: "final"; readonly outcome: AssetValidationOutcome };

export interface AssetValidationRecording {
  readonly kind: "recorded" | "replayed";
  readonly outcome: AssetValidationOutcome;
}

export interface AssetValidationRepository {
  find(assetId: UuidV7): Promise<AssetValidationLookup>;
  // Conditionally records only while the asset is still pending. `recorded` means this call wrote
  // the outcome; `replayed` returns the outcome that already won, so concurrent or repeated
  // validations converge on one persisted result.
  record(input: {
    readonly assetId: UuidV7;
    readonly completedAt: Date;
    readonly outcome: AssetValidationOutcome;
  }): Promise<AssetValidationRecording>;
}
