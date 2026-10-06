import { assetDerivatives, assets } from "@ador/database";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDrizzleAssetLibraryRepository } from "../src/adapters/drizzle-library-repository.ts";
import { createDrizzleAssetProcessingRepository } from "../src/adapters/drizzle-processing-repository.ts";
import type { StoredDerivative } from "../src/application/processing-repository.ts";
import { providerId } from "./support/images.ts";
import {
  database,
  now,
  repository as validationRepository,
  rejected,
  seed,
  seedValidated,
  useValidationDatabase,
} from "./support/validation-database.ts";

const library = createDrizzleAssetLibraryRepository(database);
const processing = createDrizzleAssetProcessingRepository(database);
useValidationDatabase();

const derivative = (
  kind: "thumbnail" | "preview",
  specVersion: string,
): StoredDerivative => ({
  byteLength: 10,
  contentSha256: (kind === "thumbnail" ? "a" : "b").repeat(64),
  contentType: "image/webp",
  height: 5,
  kind,
  objectKey: parseObjectKey(
    `derivatives/${createUuidV7()}/${specVersion}/${kind}.webp`,
  ),
  specVersion,
  storageProviderId: providerId,
  width: 7,
});

async function ownerOf(assetId: string) {
  const [row] = await database
    .select({ userId: assets.userId })
    .from(assets)
    .where(eq(assets.id, assetId));
  if (row === undefined) throw new Error("seeded asset is missing");
  return uuidV7Schema.parse(row.userId);
}

async function processedAsset() {
  const seeded = await seedValidated();
  const derivatives = [
    derivative("thumbnail", "webp-v1"),
    derivative("preview", "webp-v1"),
  ];
  await processing.record({
    assetId: seeded.assetId,
    completedAt: now,
    createId: createUuidV7,
    outcome: { derivatives, state: "processed" },
  });
  return { ...seeded, derivatives, userId: await ownerOf(seeded.assetId) };
}

const setCreatedAt = (assetId: string, at: string) =>
  database
    .update(assets)
    .set({ createdAt: new Date(at) })
    .where(eq(assets.id, assetId));

describe("asset library persistence", () => {
  it("returns nothing for a user without uploads", async () => {
    expect(
      await library.listNewestForUser({ limit: 10, userId: createUuidV7() }),
    ).toEqual([]);
  });

  it("returns only the caller's assets, never another user's", async () => {
    const mine = await processedAsset();
    const theirs = await processedAsset();
    const listed = await library.listNewestForUser({
      limit: 10,
      userId: mine.userId,
    });
    expect(listed.map(({ id }) => id)).toEqual([mine.assetId]);
    expect(
      (
        await library.listNewestForUser({ limit: 10, userId: theirs.userId })
      ).map(({ id }) => id),
    ).toEqual([theirs.assetId]);
  });

  it("describes processed, pending, and rejected assets with their renditions", async () => {
    const done = await processedAsset();
    const [record] = await library.listNewestForUser({
      limit: 10,
      userId: done.userId,
    });
    expect(record).toMatchObject({
      heightPixels: 5,
      id: done.assetId,
      processingState: "processed",
      purpose: "collection-artwork",
      rejectionReason: null,
      widthPixels: 7,
    });
    expect(
      record?.derivatives
        .map(({ kind, objectKey }) => [kind, objectKey])
        .sort(),
    ).toEqual(
      done.derivatives.map(({ kind, objectKey }) => [kind, objectKey]).sort(),
    );

    const pending = await seed();
    expect(
      (
        await library.listNewestForUser({
          limit: 10,
          userId: await ownerOf(pending.assetId),
        })
      )[0],
    ).toMatchObject({
      derivatives: [],
      heightPixels: null,
      processingState: "pending-validation",
      rejectionReason: null,
      widthPixels: null,
    });

    const refused = await seed();
    await validationRepository.record({
      assetId: refused.assetId,
      completedAt: now,
      outcome: rejected,
    });
    expect(
      (
        await library.listNewestForUser({
          limit: 10,
          userId: await ownerOf(refused.assetId),
        })
      )[0],
    ).toMatchObject({
      derivatives: [],
      processingState: "rejected",
      rejectionReason: "malformed",
    });
  });

  it("lists newest first and honors the limit", async () => {
    const first = await processedAsset();
    const second = await processedAsset();
    // Give both assets the same owner by moving the second one over.
    await database
      .update(assets)
      .set({ userId: first.userId })
      .where(eq(assets.id, second.assetId));
    await setCreatedAt(first.assetId, "2026-10-01T00:00:00.000Z");
    await setCreatedAt(second.assetId, "2026-10-02T00:00:00.000Z");
    const ids = async (limit: number) =>
      (await library.listNewestForUser({ limit, userId: first.userId })).map(
        ({ id }) => id,
      );
    expect(await ids(10)).toEqual([second.assetId, first.assetId]);
    expect(await ids(1)).toEqual([second.assetId]);
  });

  it("reports the newest rendition per kind when a spec was superseded", async () => {
    const done = await processedAsset();
    const [original] = await database
      .select()
      .from(assetDerivatives)
      .where(eq(assetDerivatives.assetId, done.assetId));
    if (original === undefined) throw new Error("missing derivative row");
    const newer = derivative("thumbnail", "webp-v2");
    await database.insert(assetDerivatives).values({
      assetId: done.assetId,
      byteLength: 10,
      contentSha256: newer.contentSha256,
      contentType: newer.contentType,
      createdAt: new Date(original.createdAt.getTime() + 60_000),
      heightPixels: 3,
      id: createUuidV7(),
      kind: "thumbnail",
      objectKey: newer.objectKey,
      specVersion: "webp-v2",
      storageProviderId: providerId,
      widthPixels: 4,
    });
    const [record] = await library.listNewestForUser({
      limit: 10,
      userId: done.userId,
    });
    const thumbnails = record?.derivatives.filter(
      ({ kind }) => kind === "thumbnail",
    );
    expect(thumbnails).toEqual([
      expect.objectContaining({
        heightPixels: 3,
        objectKey: newer.objectKey,
        widthPixels: 4,
      }),
    ]);
    expect(record?.derivatives).toHaveLength(2);
  });
});
