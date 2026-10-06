import { assets } from "@ador/database";
import { describe, expect, it } from "vitest";

import {
  database,
  png,
  repository,
  seed,
  sha,
  now,
  rejected,
  unknownAssetId,
  useValidationDatabase,
  validated,
} from "./support/validation-database.ts";
import { providerId } from "./support/images.ts";

useValidationDatabase();

describe("asset validation persistence", () => {
  it("finds a pending asset with its declared intent and no other asset", async () => {
    const { assetId, objectKey } = await seed();
    expect(await repository.find(unknownAssetId())).toEqual({
      kind: "missing",
    });
    expect(await repository.find(assetId)).toMatchObject({
      kind: "pending",
      subject: {
        assetId,
        declaredByteLength: png.length,
        declaredContentType: "image/png",
        objectKey,
        purpose: "collection-artwork",
        storageProviderId: providerId,
      },
    });
  });

  it("persists a validated outcome and reads it back as final", async () => {
    const { assetId } = await seed();
    expect(
      await repository.record({
        assetId,
        completedAt: now,
        outcome: validated,
      }),
    ).toEqual({ kind: "recorded", outcome: validated });
    expect(await repository.find(assetId)).toEqual({
      kind: "final",
      outcome: validated,
    });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      contentSha256: sha,
      detectedContentType: "image/png",
      heightPixels: 5,
      processingState: "validated",
      rejectionReason: null,
      validatedEntityTag: "etag-1",
      updatedAt: now,
      validationCompletedAt: now,
      widthPixels: 7,
    });
  });

  it("persists a rejection without hash or geometry", async () => {
    const { assetId } = await seed();
    await repository.record({ assetId, completedAt: now, outcome: rejected });
    expect(await repository.find(assetId)).toEqual({
      kind: "final",
      outcome: rejected,
    });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      contentSha256: null,
      processingState: "rejected",
      rejectionReason: "malformed",
      widthPixels: null,
    });
  });

  it("never overwrites a final outcome and returns the winner to later callers", async () => {
    const { assetId } = await seed();
    await repository.record({ assetId, completedAt: now, outcome: validated });
    expect(
      await repository.record({ assetId, completedAt: now, outcome: rejected }),
    ).toEqual({ kind: "replayed", outcome: validated });
    const [row] = await database.select().from(assets);
    expect(row?.processingState).toBe("validated");
  });

  it("lets exactly one of many concurrent recordings win", async () => {
    const { assetId } = await seed();
    const recordings = await Promise.all([
      repository.record({ assetId, completedAt: now, outcome: validated }),
      repository.record({ assetId, completedAt: now, outcome: rejected }),
      repository.record({ assetId, completedAt: now, outcome: rejected }),
    ]);
    expect(recordings.filter(({ kind }) => kind === "recorded")).toHaveLength(
      1,
    );
    const winner = recordings.find(({ kind }) => kind === "recorded");
    expect(
      recordings.every(
        ({ outcome }) => outcome.state === winner?.outcome.state,
      ),
    ).toBe(true);
    const [row] = await database.select().from(assets);
    expect(row?.processingState).toBe(winner?.outcome.state);
  });
});
