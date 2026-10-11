import { assets, uploadIntents } from "@ador/database";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { idempotencyKeySchema } from "@ador/shared/http";
import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createDrizzleAssetLibraryRepository } from "../src/adapters/drizzle-library-repository.ts";
import { createDrizzleUploadIntentRepository } from "../src/adapters/drizzle-repository.ts";
import {
  database,
  seed,
  useValidationDatabase,
} from "./support/validation-database.ts";

useValidationDatabase();
const library = createDrizzleAssetLibraryRepository(database);
const reservations = createDrizzleUploadIntentRepository(database);

async function ownerOf(assetId: string) {
  const [row] = await database
    .select({ userId: assets.userId })
    .from(assets)
    .where(eq(assets.id, assetId));
  if (row === undefined) throw new Error("seeded asset is missing");
  return uuidV7Schema.parse(row.userId);
}

describe("upload file names", () => {
  it("are stored with the intent and shown with the asset, or null when none was given", async () => {
    const named = await seed({ fileName: "piece 1.png" });
    const unnamed = await seed();
    const read = async (assetId: typeof named.assetId) =>
      (
        await library.listByIdsForUser({
          assetIds: [assetId],
          userId: await ownerOf(assetId),
        })
      )[0]?.fileName;
    expect(await read(named.assetId)).toBe("piece 1.png");
    expect(await read(unnamed.assetId)).toBeNull();
  });

  it("are kept when the intent is reserved", async () => {
    const now = new Date("2026-10-06T12:00:00.000Z");
    const owner = await seed();
    const id = createUuidV7();
    const result = await reservations.reserve({
      activeLimit: 5,
      byteLength: 10,
      cleanupEligibleAt: new Date(now.getTime() + 86_400_000),
      contentType: "image/png",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 900_000),
      fileName: "reserved.png",
      id,
      idempotencyKey: idempotencyKeySchema.parse("reserve-file-name-1"),
      objectKey: parseObjectKey(`drafts/${id}`),
      purpose: "collection-item-artwork",
      requestFingerprint: "c".repeat(64),
      retainUntil: new Date(now.getTime() + 2_592_000_000),
      storageProviderId: providerIdSchema.parse("test-object-storage"),
      userId: await ownerOf(owner.assetId),
    });
    expect(result.kind).toBe("reserved");
    const [row] = await database
      .select({ fileName: uploadIntents.fileName })
      .from(uploadIntents)
      .where(eq(uploadIntents.id, id));
    expect(row?.fileName).toBe("reserved.png");
  });

  it.each([
    ["a folder separator", "a/b.png"],
    ["a backslash", "a\\b.png"],
    ["a control character", "a\nb.png"],
    ["nothing", ""],
    ["more than 255 characters", "a".repeat(256)],
  ])("cannot be stored when the name has %s", async (_why, fileName) => {
    await expect(seed({ fileName })).rejects.toThrow();
  });
});
