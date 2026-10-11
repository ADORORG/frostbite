import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { ObjectStorageError } from "@ador/object-storage/errors";
import type { UuidV7 } from "@ador/shared/identifiers";
import {
  resolveUploadPolicy,
  type LibraryAsset,
  type LibraryResponse,
  type UploadPolicyOverrides,
} from "@ador/shared/uploads";

import type {
  AssetLibraryRepository,
  LibraryAssetRecord,
} from "./library-repository.ts";

const millisecondsPerSecond = 1_000;

// Lists the caller's assets with short-lived signed derivative URLs (ADR-016). Ownership is enforced
// by the repository query; this service never signs a key it did not receive from that query.
export function createAssetLibraryService(dependencies: {
  readonly policy?: UploadPolicyOverrides;
  readonly repository: AssetLibraryRepository;
  readonly storage: ObjectStoragePort;
}) {
  const policy = resolveUploadPolicy(dependencies.policy);
  const expiresInSeconds =
    policy.derivativeReadLifetimeMs / millisecondsPerSecond;

  async function present(record: LibraryAssetRecord): Promise<LibraryAsset> {
    const base = {
      createdAt: record.createdAt.toISOString(),
      fileName: record.fileName,
      heightPixels: record.heightPixels,
      id: record.id,
      processingState: record.processingState,
      purpose: record.purpose,
      rejectionReason: record.rejectionReason,
      widthPixels: record.widthPixels,
    };
    if (record.processingState !== "processed")
      return { ...base, derivativeAccess: "none", derivatives: [] };
    try {
      const derivatives = await Promise.all(
        record.derivatives.map(async (derivative) => {
          const signed = await dependencies.storage.presignPrivateRead({
            expiresInSeconds,
            key: derivative.objectKey,
          });
          return {
            contentType: derivative.contentType,
            expiresAt: signed.expiresAt.toISOString(),
            heightPixels: derivative.heightPixels,
            kind: derivative.kind,
            url: signed.url.toString(),
            widthPixels: derivative.widthPixels,
          };
        }),
      );
      // A processed asset without renditions is inconsistent; say so rather than show an empty tile.
      return derivatives.length === 0
        ? { ...base, derivativeAccess: "unavailable", derivatives: [] }
        : { ...base, derivativeAccess: "available", derivatives };
    } catch (error) {
      // A storage outage must not hide the asset's state; anything else is a defect and propagates.
      if (!(error instanceof ObjectStorageError)) throw error;
      return { ...base, derivativeAccess: "unavailable", derivatives: [] };
    }
  }

  return {
    // The caller's own assets among `assetIds`, presented like the library (state and signed
    // renditions). Unknown or foreign ids are absent from the result.
    async getMany(
      userId: UuidV7,
      assetIds: readonly UuidV7[],
    ): Promise<readonly LibraryAsset[]> {
      const records = await dependencies.repository.listByIdsForUser({
        assetIds,
        userId,
      });
      return Promise.all(records.map(present));
    },

    async list(userId: UuidV7): Promise<LibraryResponse> {
      const records = await dependencies.repository.listNewestForUser({
        limit: policy.libraryPageSize + 1,
        userId,
      });
      const page = records.slice(0, policy.libraryPageSize);
      return {
        assets: await Promise.all(page.map(present)),
        truncated: records.length > policy.libraryPageSize,
      };
    },
  };
}
