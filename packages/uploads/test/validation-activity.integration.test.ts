import { assets } from "@frostbite/database";
import { ObjectStorageError } from "@frostbite/object-storage/errors";
import { defaultUploadPolicy } from "@frostbite/shared/uploads";
import { describe, expect, it } from "vitest";

import { createAssetValidationService } from "../src/application/validation-service.ts";
import { fakeStorage } from "./support/images.ts";
import {
  database,
  now,
  png,
  repository,
  seed,
  useValidationDatabase,
} from "./support/validation-database.ts";

useValidationDatabase();

describe("asset validation activity over PostgreSQL", () => {
  function activity(storage: ReturnType<typeof fakeStorage>) {
    return createAssetValidationService({
      clock: () => now,
      policy: defaultUploadPolicy,
      repository,
      storage,
    });
  }

  it("validates stored bytes, persists the outcome, and replays idempotently", async () => {
    const { assetId } = await seed();
    const storage = fakeStorage({ bytes: png, entityTag: "etag-7" });
    expect(await activity(storage).validate({ assetId })).toMatchObject({
      kind: "recorded",
      outcome: { entityTag: "etag-7", height: 5, state: "validated", width: 7 },
    });
    expect(await activity(storage).validate({ assetId })).toMatchObject({
      kind: "replayed",
    });
    expect(storage.reads).toHaveLength(1);
    const [row] = await database.select().from(assets);
    expect(row?.validationCompletedAt).toEqual(now);
  });

  it("persists one outcome when validation runs concurrently", async () => {
    const { assetId } = await seed();
    const results = await Promise.all([
      activity(fakeStorage({ bytes: png })).validate({ assetId }),
      activity(fakeStorage({ bytes: png })).validate({ assetId }),
    ]);
    expect(results.filter(({ kind }) => kind === "recorded")).toHaveLength(1);
    expect(await database.select().from(assets)).toHaveLength(1);
  });

  it("keeps the asset pending and retryable when storage fails, then succeeds on retry", async () => {
    const { assetId } = await seed();
    await expect(
      activity(
        fakeStorage(new ObjectStorageError("provider-failure", "down")),
      ).validate({ assetId }),
    ).rejects.toThrow("down");
    const [pending] = await database.select().from(assets);
    expect(pending).toMatchObject({
      contentSha256: null,
      processingState: "pending-validation",
    });
    expect(
      await activity(fakeStorage({ bytes: png })).validate({ assetId }),
    ).toMatchObject({
      kind: "recorded",
      outcome: { state: "validated" },
    });
  });

  it("rejects bytes that differ from the declared type and records no hash", async () => {
    const { assetId } = await seed({ byteLength: 6 });
    await activity(
      fakeStorage({ bytes: new TextEncoder().encode("<svg/>") }),
    ).validate({ assetId });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      contentSha256: null,
      processingState: "rejected",
      rejectionReason: "unsupported-format",
    });
  });
});
