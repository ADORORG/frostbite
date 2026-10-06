import { assetDerivatives, assets } from "@ador/database";
import { createUuidV7 } from "@ador/shared/identifiers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  now,
  rejected,
  repository,
  seed,
  seedValidated,
  useValidationDatabase,
} from "./support/validation-database.ts";

useValidationDatabase();
const violation = { cause: { code: "23514" } };

describe("processing states are coherent in PostgreSQL", () => {
  it.each([
    ["processed without a completion time", { processingState: "processed" }],
    [
      "processed carrying a reason",
      {
        processingCompletedAt: now,
        processingState: "processed",
        rejectionReason: "decode-failed",
      },
    ],
    [
      "unprocessable without a reason",
      { processingCompletedAt: now, processingState: "unprocessable" },
    ],
    [
      "unprocessable without a completion time",
      { processingState: "unprocessable", rejectionReason: "decode-failed" },
    ],
    ["validated carrying a completion time", { processingCompletedAt: now }],
  ] as const)("refuses %s", async (_name, values) => {
    const { assetId } = await seedValidated();
    await expect(
      database.update(assets).set(values).where(eq(assets.id, assetId)),
    ).rejects.toMatchObject(violation);
  });

  it("refuses a completion time on a pending or rejected asset", async () => {
    const pending = await seed();
    await expect(
      database
        .update(assets)
        .set({ processingCompletedAt: now })
        .where(eq(assets.id, pending.assetId)),
    ).rejects.toMatchObject(violation);
    const failed = await seed();
    await repository.record({
      assetId: failed.assetId,
      completedAt: now,
      outcome: rejected,
    });
    await expect(
      database
        .update(assets)
        .set({ processingCompletedAt: now })
        .where(eq(assets.id, failed.assetId)),
    ).rejects.toMatchObject(violation);
  });

  it("accepts the two coherent terminal processing states", async () => {
    const first = await seedValidated();
    await database
      .update(assets)
      .set({ processingCompletedAt: now, processingState: "processed" })
      .where(eq(assets.id, first.assetId));
    const second = await seedValidated();
    await database
      .update(assets)
      .set({
        processingCompletedAt: now,
        processingState: "unprocessable",
        rejectionReason: "content-changed",
      })
      .where(eq(assets.id, second.assetId));
    expect(
      (await database.select().from(assets))
        .map(({ processingState }) => processingState)
        .sort(),
    ).toEqual(["processed", "unprocessable"]);
  });
});

describe("derivative rows are constrained in PostgreSQL", () => {
  async function insert(
    overrides: Partial<typeof assetDerivatives.$inferInsert> = {},
  ) {
    const { assetId } = await seedValidated();
    return database.insert(assetDerivatives).values({
      assetId,
      byteLength: 10,
      contentSha256: "a".repeat(64),
      contentType: "image/webp",
      heightPixels: 5,
      id: createUuidV7(),
      kind: "thumbnail",
      objectKey: `derivatives/${createUuidV7()}`,
      specVersion: "webp-v1",
      storageProviderId: "test-object-storage",
      widthPixels: 7,
      ...overrides,
    });
  }

  it("accepts a well-formed row", async () => {
    await insert();
    expect(await database.select().from(assetDerivatives)).toHaveLength(1);
  });

  it.each([
    ["a malformed hash", { contentSha256: "XYZ" }],
    ["a zero byte length", { byteLength: 0 }],
    ["a zero width", { widthPixels: 0 }],
    ["a zero height", { heightPixels: 0 }],
    ["a blank spec version", { specVersion: "  " }],
    ["a blank provider", { storageProviderId: " " }],
  ])("refuses %s", async (_name, overrides) => {
    await expect(insert(overrides)).rejects.toMatchObject(violation);
  });

  it("refuses an unknown asset, a repeated kind per spec, and a repeated object key", async () => {
    await expect(insert({ assetId: createUuidV7() })).rejects.toMatchObject({
      cause: { code: "23503" },
    });
    const { assetId } = await seedValidated();
    const row = (overrides: Partial<typeof assetDerivatives.$inferInsert>) => ({
      assetId,
      byteLength: 10,
      contentSha256: "b".repeat(64),
      contentType: "image/webp" as const,
      heightPixels: 5,
      id: createUuidV7(),
      kind: "thumbnail" as const,
      objectKey: `derivatives/${createUuidV7()}`,
      specVersion: "webp-v1",
      storageProviderId: "test-object-storage",
      widthPixels: 7,
      ...overrides,
    });
    await database
      .insert(assetDerivatives)
      .values(row({ objectKey: "derivatives/shared" }));
    await expect(
      database.insert(assetDerivatives).values(row({})),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    await expect(
      database
        .insert(assetDerivatives)
        .values(row({ kind: "preview", objectKey: "derivatives/shared" })),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    await database
      .insert(assetDerivatives)
      .values(row({ specVersion: "webp-v2" }));
    expect(await database.select().from(assetDerivatives)).toHaveLength(2);
  });
});
