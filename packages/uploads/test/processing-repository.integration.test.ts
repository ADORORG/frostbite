import { assetDerivatives, assets } from "@frostbite/database";
import { parseObjectKey } from "@frostbite/object-storage/contracts";
import { createUuidV7 } from "@frostbite/shared/identifiers";
import { describe, expect, it } from "vitest";

import { createDrizzleAssetProcessingRepository } from "../src/adapters/drizzle-processing-repository.ts";
import type {
  AssetProcessingOutcome,
  StoredDerivative,
} from "../src/application/processing-repository.ts";
import { providerId } from "./support/images.ts";
import {
  database,
  now,
  png,
  pngSha256,
  rejected,
  repository as validationRepository,
  seed,
  seedValidated,
  unknownAssetId,
  useValidationDatabase,
} from "./support/validation-database.ts";

const repository = createDrizzleAssetProcessingRepository(database);
useValidationDatabase();

const derivative = (
  kind: "thumbnail" | "preview",
  fill: string,
): StoredDerivative => ({
  byteLength: 10,
  contentSha256: fill.repeat(64),
  contentType: "image/webp",
  height: 5,
  kind,
  objectKey: parseObjectKey(
    `derivatives/${createUuidV7()}/webp-v1/${kind}.webp`,
  ),
  specVersion: "webp-v1",
  storageProviderId: providerId,
  width: 7,
});
// Recorded in reverse of kind order, so reading them back sorted proves the ORDER BY.
const processed = (): Extract<
  AssetProcessingOutcome,
  { state: "processed" }
> => ({
  derivatives: [derivative("preview", "b"), derivative("thumbnail", "a")],
  state: "processed",
});
const record = (
  assetId: Parameters<typeof repository.record>[0]["assetId"],
  outcome: AssetProcessingOutcome,
) =>
  repository.record({
    assetId,
    completedAt: now,
    createId: createUuidV7,
    outcome,
  });

describe("asset processing persistence", () => {
  it("finds assets by readiness", async () => {
    expect(await repository.find(unknownAssetId())).toEqual({
      kind: "missing",
    });
    const waiting = await seed();
    expect(await repository.find(waiting.assetId)).toEqual({
      kind: "not-ready",
      state: "pending-validation",
    });
    const { assetId, objectKey } = await seedValidated();
    expect(await repository.find(assetId)).toEqual({
      kind: "pending",
      subject: {
        assetId,
        byteLength: png.length,
        contentSha256: pngSha256,
        height: 5,
        objectKey,
        storageProviderId: providerId,
        width: 7,
      },
    });
  });

  it("reports a validation rejection as not ready", async () => {
    const { assetId } = await seed();
    await validationRepository.record({
      assetId,
      completedAt: now,
      outcome: rejected,
    });
    expect(await repository.find(assetId)).toEqual({
      kind: "not-ready",
      state: "rejected",
    });
  });

  it("persists derivatives with the state change and reads them back as final", async () => {
    const { assetId } = await seedValidated();
    const outcome = processed();
    expect(await record(assetId, outcome)).toEqual({
      kind: "recorded",
      outcome,
    });
    const found = await repository.find(assetId);
    expect(found).toMatchObject({
      kind: "final",
      outcome: { state: "processed" },
    });
    if (found.kind !== "final" || found.outcome.state !== "processed")
      throw new Error("expected final");
    // Every persisted field round-trips; the stored order is the enum order, not insertion order.
    expect(found.outcome).toEqual({
      derivatives: [...outcome.derivatives].reverse(),
      state: "processed",
    });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      processingCompletedAt: now,
      processingState: "processed",
      rejectionReason: null,
    });
    expect(await database.select().from(assetDerivatives)).toHaveLength(2);
  });

  it("persists an unprocessable outcome with its reason and no derivatives", async () => {
    const { assetId } = await seedValidated();
    const outcome: AssetProcessingOutcome = {
      reason: "decode-failed",
      state: "unprocessable",
    };
    expect(await record(assetId, outcome)).toEqual({
      kind: "recorded",
      outcome,
    });
    expect(await repository.find(assetId)).toEqual({ kind: "final", outcome });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      processingState: "unprocessable",
      rejectionReason: "decode-failed",
    });
    expect(await database.select().from(assetDerivatives)).toHaveLength(0);
  });

  it("never overwrites a final outcome and returns the winner with its derivatives", async () => {
    const { assetId } = await seedValidated();
    const winner = processed();
    await record(assetId, winner);
    expect(
      await record(assetId, {
        reason: "decode-failed",
        state: "unprocessable",
      }),
    ).toMatchObject({
      kind: "replayed",
      outcome: {
        derivatives: expect.arrayContaining([
          expect.objectContaining({ kind: "thumbnail" }),
        ]),
        state: "processed",
      },
    });
    expect(await record(assetId, processed())).toMatchObject({
      kind: "replayed",
    });
    expect(await database.select().from(assetDerivatives)).toHaveLength(2);
  });

  it("lets exactly one of many concurrent recordings win and inserts derivatives once", async () => {
    const { assetId } = await seedValidated();
    const recordings = await Promise.all([
      record(assetId, processed()),
      record(assetId, processed()),
      record(assetId, { reason: "decode-failed", state: "unprocessable" }),
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
    expect(await database.select().from(assetDerivatives)).toHaveLength(
      winner?.outcome.state === "processed" ? 2 : 0,
    );
  });

  it("refuses to record against an asset that is not validated, changing nothing", async () => {
    const { assetId } = await seed();
    await expect(record(assetId, processed())).rejects.toThrow("not ready");
    const [row] = await database.select().from(assets);
    expect(row?.processingState).toBe("pending-validation");
    expect(await database.select().from(assetDerivatives)).toHaveLength(0);
  });

  it("rolls the state change back when a derivative row cannot be inserted", async () => {
    const { assetId } = await seedValidated();
    const duplicate = derivative("thumbnail", "c");
    await expect(
      record(assetId, {
        derivatives: [
          duplicate,
          {
            ...duplicate,
            objectKey: parseObjectKey("derivatives/other/key.webp"),
          },
        ],
        state: "processed",
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    const [row] = await database.select().from(assets);
    expect(row).toMatchObject({
      processingCompletedAt: null,
      processingState: "validated",
    });
    expect(await database.select().from(assetDerivatives)).toHaveLength(0);
  });
});
