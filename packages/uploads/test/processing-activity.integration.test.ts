import { assetDerivatives, assets } from "@frostbite/database";
import { ObjectStorageError } from "@frostbite/object-storage/errors";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import {
  defaultDerivativePolicy,
  defaultUploadPolicy,
} from "@frostbite/shared/uploads";
import { describe, expect, it } from "vitest";

import { createDrizzleAssetProcessingRepository } from "../src/adapters/drizzle-processing-repository.ts";
import { createAssetProcessingService } from "../src/application/processing-service.ts";
import {
  fakeProcessor,
  processingStorage,
} from "./support/processing-fakes.ts";
import {
  database,
  now,
  png,
  seedValidated,
  useValidationDatabase,
} from "./support/validation-database.ts";

useValidationDatabase();

const produced = {
  derivatives: [
    { bytes: Uint8Array.of(1, 2, 3), height: 5, kind: "thumbnail", width: 7 },
    { bytes: Uint8Array.of(4, 5, 6, 7), height: 5, kind: "preview", width: 7 },
  ],
  ok: true,
} as const;

function activity(
  storage: ReturnType<typeof processingStorage>,
  processor = fakeProcessor(produced),
) {
  return createAssetProcessingService({
    clock: () => now,
    createId: createUuidV7,
    derivativePolicy: defaultDerivativePolicy,
    processor,
    repository: createDrizzleAssetProcessingRepository(database),
    storage: storage.storage,
    uploadPolicy: defaultUploadPolicy,
  });
}

describe("asset processing over PostgreSQL", () => {
  it("stores derivatives, persists them with the state change, and replays idempotently", async () => {
    const { assetId } = await seedValidated();
    const storage = processingStorage({ source: png });
    expect(await activity(storage).process({ assetId })).toMatchObject({
      kind: "recorded",
      outcome: { state: "processed" },
    });
    expect(await activity(storage).process({ assetId })).toMatchObject({
      kind: "replayed",
      outcome: { state: "processed" },
    });
    expect(storage.writes).toHaveLength(2);
    expect(storage.reads).toHaveLength(1);
    const [asset] = await database.select().from(assets);
    expect(asset).toMatchObject({
      processingCompletedAt: now,
      processingState: "processed",
    });
    const rows = await database.select().from(assetDerivatives);
    expect(
      rows
        .map(({ kind, byteLength, specVersion }) => [
          kind,
          byteLength,
          specVersion,
        ])
        .sort(),
    ).toEqual([
      ["preview", 4, "webp-v1"],
      ["thumbnail", 3, "webp-v1"],
    ]);
    expect(
      rows.every(({ objectKey }) =>
        objectKey.startsWith(`derivatives/${assetId}/webp-v1/`),
      ),
    ).toBe(true);
  });

  it("marks an asset whose bytes changed after validation unprocessable", async () => {
    const { assetId } = await seedValidated();
    const storage = processingStorage({
      source: new Uint8Array(png.length).fill(1),
    });
    const processor = fakeProcessor(produced);
    await activity(storage, processor).process({ assetId });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      processingState: "unprocessable",
      rejectionReason: "content-changed",
    });
    expect(processor.inputs).toHaveLength(0);
    expect(await database.select().from(assetDerivatives)).toHaveLength(0);
  });

  it("persists a deterministic decoder rejection", async () => {
    const { assetId } = await seedValidated();
    await activity(
      processingStorage({ source: png }),
      fakeProcessor({ ok: false, reason: "decode-failed" }),
    ).process({ assetId });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      processingState: "unprocessable",
      rejectionReason: "decode-failed",
    });
  });

  it("stays validated and retryable when storage fails, then succeeds on retry", async () => {
    const { assetId } = await seedValidated();
    const failing = processingStorage({
      onWrite: () => {
        throw new ObjectStorageError("provider-failure", "down");
      },
      source: png,
    });
    await expect(activity(failing).process({ assetId })).rejects.toThrow(
      "down",
    );
    const [pending] = await database.select().from(assets);
    expect(pending).toMatchObject({
      processingCompletedAt: null,
      processingState: "validated",
    });
    expect(await database.select().from(assetDerivatives)).toHaveLength(0);
    expect(
      await activity(processingStorage({ source: png })).process({ assetId }),
    ).toMatchObject({ kind: "recorded" });
  });

  it("does not touch assets that are not validated", async () => {
    const { assetId } = await seedValidated();
    await database
      .update(assets)
      .set({ processingCompletedAt: now, processingState: "processed" });
    const storage = processingStorage({ source: png });
    expect(await activity(storage).process({ assetId })).toMatchObject({
      kind: "replayed",
    });
    expect(storage.reads).toHaveLength(0);
  });
});
