import type { ObjectKey } from "@ador/object-storage/contracts";
import type { UuidV7 } from "@ador/shared/identifiers";
import type {
  AssetProcessingState,
  AssetRejectionReason,
  DerivativeKind,
  UploadContentType,
  UploadPurpose,
} from "@ador/shared/uploads";

export interface LibraryDerivativeRecord {
  readonly contentType: UploadContentType;
  readonly heightPixels: number;
  readonly kind: DerivativeKind;
  readonly objectKey: ObjectKey;
  readonly widthPixels: number;
}

export interface LibraryAssetRecord {
  readonly createdAt: Date;
  // At most one per kind: the newest rendition.
  readonly derivatives: readonly LibraryDerivativeRecord[];
  // The name the file had when it was uploaded; null when none was given.
  readonly fileName: string | null;
  readonly heightPixels: number | null;
  readonly id: UuidV7;
  readonly processingState: AssetProcessingState;
  readonly purpose: UploadPurpose;
  readonly rejectionReason: AssetRejectionReason | null;
  readonly widthPixels: number | null;
}

export interface AssetLibraryRepository {
  // The caller's own assets, newest first, starting after `before` when given (the creation time to the millisecond, and
  // the id, of the last asset already seen). Never returns another user's asset.
  listNewestForUser(input: {
    readonly before?: { readonly createdAtMs: number; readonly id: UuidV7 };
    readonly limit: number;
    readonly userId: UuidV7;
  }): Promise<readonly LibraryAssetRecord[]>;
  // The caller's own assets among `assetIds`, in no particular order. An id that is unknown or
  // belongs to someone else is simply absent: ownership is part of the query.
  listByIdsForUser(input: {
    readonly assetIds: readonly UuidV7[];
    readonly userId: UuidV7;
  }): Promise<readonly LibraryAssetRecord[]>;
}
