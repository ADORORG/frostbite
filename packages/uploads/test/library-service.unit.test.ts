import {
  parseObjectKey,
  type ObjectStoragePort,
} from "@ador/object-storage/contracts";
import { ObjectStorageError } from "@ador/object-storage/errors";
import { createUuidV7 } from "@ador/shared/identifiers";
import { unusedStorage } from "@ador/test-kit/storage-registry";
import { describe, expect, it, vi } from "vitest";

import type {
  AssetLibraryRepository,
  LibraryAssetRecord,
} from "../src/application/library-repository.ts";
import { createAssetLibraryService } from "../src/application/library-service.ts";

const userId = createUuidV7();
const createdAt = new Date("2026-10-06T12:00:00.000Z");
const issued = new Date("2026-10-06T12:05:00.000Z");

const record = (
  overrides: Partial<LibraryAssetRecord> = {},
): LibraryAssetRecord => ({
  createdAt,
  derivatives: [
    {
      contentType: "image/webp",
      heightPixels: 3,
      kind: "thumbnail",
      objectKey: parseObjectKey("derivatives/a/thumbnail.webp"),
      widthPixels: 4,
    },
    {
      contentType: "image/webp",
      heightPixels: 30,
      kind: "preview",
      objectKey: parseObjectKey("derivatives/a/preview.webp"),
      widthPixels: 40,
    },
  ],
  fileName: null,
  heightPixels: 30,
  id: createUuidV7(),
  processingState: "processed",
  purpose: "collection-artwork",
  rejectionReason: null,
  widthPixels: 40,
  ...overrides,
});

function setup(
  records: readonly LibraryAssetRecord[],
  options: {
    policy?: Parameters<typeof createAssetLibraryService>[0]["policy"];
    presign?: ObjectStoragePort["presignPrivateRead"];
  } = {},
) {
  const listNewestForUser = vi.fn(async () => records);
  const listByIdsForUser = vi.fn(async () => records);
  const repository: AssetLibraryRepository = {
    listByIdsForUser,
    listNewestForUser,
  };
  const defaultPresign: ObjectStoragePort["presignPrivateRead"] = async ({
    key,
  }) => ({
    expiresAt: issued,
    url: new URL(`https://storage.example.test/${key}?sig=1`),
  });
  const presignPrivateRead = vi.fn(options.presign ?? defaultPresign);
  // Only the one method under test works; every other call on `unusedStorage` would throw.
  const storage: ObjectStoragePort = { ...unusedStorage, presignPrivateRead };
  return {
    listByIdsForUser,
    listNewestForUser,
    presignPrivateRead,
    service: createAssetLibraryService({
      policy: options.policy,
      repository,
      storage,
    }),
  };
}

describe("asset library service", () => {
  it("presents requested assets like the library, scoped to the caller", async () => {
    const asset = record();
    const { listByIdsForUser, presignPrivateRead, service } = setup([asset]);
    const result = await service.getMany(userId, [asset.id]);
    expect(listByIdsForUser).toHaveBeenCalledWith({
      assetIds: [asset.id],
      userId,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      derivativeAccess: "available",
      id: asset.id,
      processingState: "processed",
    });
    expect(presignPrivateRead).toHaveBeenCalledTimes(2);
  });

  it("signs nothing for an asset that is not processed", async () => {
    const pending = record({
      derivatives: [],
      processingState: "pending-validation",
    });
    const { presignPrivateRead, service } = setup([pending]);
    const [result] = await service.getMany(userId, [pending.id]);
    expect(result).toMatchObject({
      derivativeAccess: "none",
      derivatives: [],
    });
    expect(presignPrivateRead).not.toHaveBeenCalled();
  });

  it("signs each rendition of a processed asset for the policy lifetime", async () => {
    const asset = record({ fileName: "piece-1.png" });
    const { presignPrivateRead, service } = setup([asset]);
    const result = await service.list(userId);
    expect(presignPrivateRead.mock.calls.map(([input]) => input)).toEqual([
      { expiresInSeconds: 300, key: "derivatives/a/thumbnail.webp" },
      { expiresInSeconds: 300, key: "derivatives/a/preview.webp" },
    ]);
    expect(result).toEqual({
      assets: [
        {
          createdAt: createdAt.toISOString(),
          derivativeAccess: "available",
          derivatives: [
            {
              contentType: "image/webp",
              expiresAt: issued.toISOString(),
              heightPixels: 3,
              kind: "thumbnail",
              url: "https://storage.example.test/derivatives/a/thumbnail.webp?sig=1",
              widthPixels: 4,
            },
            {
              contentType: "image/webp",
              expiresAt: issued.toISOString(),
              heightPixels: 30,
              kind: "preview",
              url: "https://storage.example.test/derivatives/a/preview.webp?sig=1",
              widthPixels: 40,
            },
          ],
          fileName: "piece-1.png",
          heightPixels: 30,
          id: asset.id,
          processingState: "processed",
          purpose: "collection-artwork",
          rejectionReason: null,
          widthPixels: 40,
        },
      ],
      nextCursor: null,
    });
  });

  it("uses the configured lifetime", async () => {
    const { presignPrivateRead, service } = setup([record()], {
      policy: { derivativeReadLifetimeMs: 120_000 },
    });
    await service.list(userId);
    expect(presignPrivateRead.mock.calls[0]?.[0].expiresInSeconds).toBe(120);
  });

  it.each([
    "pending-validation",
    "validated",
    "rejected",
    "unprocessable",
  ] as const)(
    "never signs anything for a %s asset",
    async (processingState) => {
      const { presignPrivateRead, service } = setup([
        record({
          processingState,
          rejectionReason: processingState === "rejected" ? "malformed" : null,
        }),
      ]);
      const [asset] = (await service.list(userId)).assets;
      expect(asset).toMatchObject({
        derivativeAccess: "none",
        derivatives: [],
        processingState,
      });
      expect(presignPrivateRead).not.toHaveBeenCalled();
    },
  );

  it("keeps listing an asset whose renditions cannot be signed", async () => {
    const { service } = setup([record(), record()], {
      presign: async () => {
        throw new ObjectStorageError("provider-failure", "down");
      },
    });
    const result = await service.list(userId);
    expect(
      result.assets.map(({ derivativeAccess }) => derivativeAccess),
    ).toEqual(["unavailable", "unavailable"]);
    expect(
      result.assets.every(({ derivatives }) => derivatives.length === 0),
    ).toBe(true);
  });

  it("marks a processed asset with no renditions as unavailable instead of empty", async () => {
    const { service } = setup([record({ derivatives: [] })]);
    expect((await service.list(userId)).assets[0]?.derivativeAccess).toBe(
      "unavailable",
    );
  });

  it("lets non-storage failures surface instead of hiding a defect", async () => {
    const { service } = setup([record()], {
      presign: async () => {
        throw new TypeError("bug");
      },
    });
    await expect(service.list(userId)).rejects.toThrow("bug");
  });

  it("asks for one extra row to know whether more follow, and returns only a page with a cursor to the next", async () => {
    const records = Array.from({ length: 3 }, () =>
      record({ processingState: "validated" }),
    );
    const { listNewestForUser, service } = setup(records, {
      policy: { libraryPageSize: 2 },
    });
    const result = await service.list(userId);
    expect(listNewestForUser).toHaveBeenCalledWith({ limit: 3, userId });
    expect(result.assets.map(({ id }) => id)).toEqual(
      records.slice(0, 2).map(({ id }) => id),
    );
    expect(result.nextCursor).toBe(
      `${String(records[1]?.createdAt.getTime()).padStart(13, "0")}.${records[1]?.id}`,
    );
    const exact = setup(records.slice(0, 2), {
      policy: { libraryPageSize: 2 },
    });
    expect((await exact.service.list(userId)).nextCursor).toBeNull();
  });

  it("starts after the cursor it is given, parsing it for the query, and gives the next cursor from the last asset it returns", async () => {
    const records = Array.from({ length: 3 }, () =>
      record({ processingState: "validated" }),
    );
    const { listNewestForUser, service } = setup(records, {
      policy: { libraryPageSize: 2 },
    });
    const before = `1760000000123.${userId}`;
    const page = await service.list(userId, before);
    expect(listNewestForUser).toHaveBeenCalledWith({
      before: { createdAtMs: 1_760_000_000_123, id: userId },
      limit: 3,
      userId,
    });
    expect(page.assets).toHaveLength(2);
    expect(page.nextCursor).toBe(
      `${String(records[1]?.createdAt.getTime()).padStart(13, "0")}.${records[1]?.id}`,
    );
  });

  it("refuses a cursor whose id is not an id, before it reaches a query", async () => {
    const { listNewestForUser, service } = setup([]);
    await expect(
      service.list(userId, "1760000000123.not-an-id"),
    ).rejects.toThrow();
    expect(listNewestForUser).not.toHaveBeenCalled();
  });

  it("ends with no cursor on an empty older page", async () => {
    const { service } = setup([]);
    await expect(
      service.list(userId, `1760000000123.${userId}`),
    ).resolves.toEqual({ assets: [], nextCursor: null });
  });

  it("returns an empty library", async () => {
    expect(await setup([]).service.list(userId)).toEqual({
      assets: [],
      nextCursor: null,
    });
  });

  it("rejects an invalid policy at construction", () => {
    expect(() => setup([], { policy: { libraryPageSize: 0 } })).toThrow();
  });
});
