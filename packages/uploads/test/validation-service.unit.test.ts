import { createHash } from "node:crypto";

import { parseObjectKey } from "@ador/object-storage/contracts";
import { ObjectStorageError } from "@ador/object-storage/errors";
import { createUuidV7 } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { defaultUploadPolicy, resolveUploadPolicy } from "@ador/shared/uploads";
import { describe, expect, it } from "vitest";

import { createAssetValidationService } from "../src/application/validation-service.ts";
import type { AssetValidationSubject } from "../src/application/validation-repository.ts";
import { fakeStorage, providerId, tinyPng } from "./support/images.ts";
import { memoryRepository } from "./support/memory-repository.ts";

const png = tinyPng(7, 5);
const completedAt = new Date("2026-10-06T12:00:00.000Z");

function setup(
  object: Parameters<typeof fakeStorage>[0],
  overrides: Partial<AssetValidationSubject> = {},
  policy = defaultUploadPolicy,
) {
  const subject: AssetValidationSubject = {
    assetId: createUuidV7(),
    declaredByteLength: png.length,
    declaredContentType: "image/png",
    objectKey: parseObjectKey("drafts/object"),
    purpose: "creator-avatar",
    storageProviderId: providerId,
    ...overrides,
  };
  const repository = memoryRepository(subject);
  const storage = fakeStorage(object);
  const service = createAssetValidationService({
    clock: () => completedAt,
    policy,
    repository,
    storage,
  });
  return { repository, service, storage, subject };
}

describe("asset validation activity", () => {
  it("records geometry, hash, entity tag, and validator version for a valid image", async () => {
    const { service, subject } = setup({ bytes: png, entityTag: "etag-9" });
    const result = await service.validate({ assetId: subject.assetId });
    expect(result).toMatchObject({
      kind: "recorded",
      outcome: {
        contentSha256: createHash("sha256").update(png).digest("hex"),
        contentType: "image/png",
        entityTag: "etag-9",
        height: 5,
        state: "validated",
        validatorVersion: "structural-v1",
        width: 7,
      },
    });
  });

  it.each([
    [
      "spoofed media type",
      { bytes: png },
      { declaredContentType: "image/jpeg" as const },
      "media-type-mismatch",
    ],
    [
      "unsupported content",
      { bytes: new TextEncoder().encode("<svg/>") },
      { declaredByteLength: 6 },
      "unsupported-format",
    ],
    [
      "oversized dimensions",
      { bytes: tinyPng(9_000, 10) },
      { declaredByteLength: tinyPng(9_000, 10).length },
      "dimensions-exceeded",
    ],
    [
      "truncated image",
      { bytes: png.subarray(0, 40) },
      { declaredByteLength: 40 },
      "malformed",
    ],
    [
      "provider length differs",
      { bytes: png, contentLength: png.length + 1 },
      {},
      "byte-length-mismatch",
    ],
    [
      "object larger than declared",
      {
        bytes: png,
        contentLength: png.length,
        body: [Buffer.from(png), Buffer.from([0])],
      },
      {},
      "byte-length-mismatch",
    ],
    [
      "object shorter than declared",
      {
        bytes: png,
        contentLength: png.length,
        body: [Buffer.from(png.subarray(0, 20))],
      },
      {},
      "byte-length-mismatch",
    ],
  ])(
    "rejects %s without storing hashes or geometry",
    async (_name, object, overrides, reason) => {
      const { service, subject } = setup(object, overrides);
      const result = await service.validate({ assetId: subject.assetId });
      expect(result).toEqual({
        kind: "recorded",
        outcome: {
          reason,
          state: "rejected",
          validatorVersion: "structural-v1",
        },
      });
    },
  );

  it("stops reading an oversized object instead of buffering all of it", async () => {
    let consumed = 0;
    function* endless() {
      for (let index = 0; index < 1_000; index += 1) {
        consumed += 1;
        yield Buffer.alloc(png.length);
      }
    }
    const { service, subject } = setup({
      body: endless(),
      bytes: png,
      contentLength: png.length,
    });
    expect(await service.validate({ assetId: subject.assetId })).toMatchObject({
      outcome: { reason: "byte-length-mismatch" },
    });
    expect(consumed).toBeLessThan(50);
  });

  it("rejects a declared size above the current policy without reading the object", async () => {
    const policy = resolveUploadPolicy({
      maxBytesByPurpose: { "creator-avatar": png.length - 1 },
    });
    const { service, storage, subject } = setup({ bytes: png }, {}, policy);
    expect(await service.validate({ assetId: subject.assetId })).toMatchObject({
      outcome: { reason: "size-exceeded", state: "rejected" },
    });
    expect(storage.reads).toHaveLength(0);
  });

  it("applies the configured dimension and pixel limits", async () => {
    const policy = resolveUploadPolicy({ maxImageDimension: 6 });
    const { service, subject } = setup({ bytes: png }, {}, policy);
    expect(await service.validate({ assetId: subject.assetId })).toMatchObject({
      outcome: { reason: "dimensions-exceeded" },
    });
    const pixels = resolveUploadPolicy({ maxImagePixels: 34 });
    const second = setup({ bytes: png }, {}, pixels);
    expect(
      await second.service.validate({ assetId: second.subject.assetId }),
    ).toMatchObject({
      outcome: { reason: "pixels-exceeded" },
    });
  });

  it("replays a final outcome without touching storage", async () => {
    const { service, storage, subject } = setup({ bytes: png });
    await service.validate({ assetId: subject.assetId });
    const readsBefore = storage.reads.length;
    expect(await service.validate({ assetId: subject.assetId })).toMatchObject({
      kind: "replayed",
      outcome: { state: "validated" },
    });
    expect(storage.reads).toHaveLength(readsBefore);
  });

  it("converges on the persisted winner when a concurrent run recorded first", async () => {
    const { repository, service, subject } = setup({ bytes: png });
    const results = await Promise.all([
      service.validate({ assetId: subject.assetId }),
      service.validate({ assetId: subject.assetId }),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "recorded",
      "replayed",
    ]);
    expect(repository.recorded).toHaveLength(2);
  });

  it("reports unknown, malformed, and cross-provider assets explicitly", async () => {
    const { service, subject } = setup({ bytes: png });
    expect(await service.validate({ assetId: createUuidV7() })).toEqual({
      kind: "unavailable",
    });
    expect(await service.validate({ assetId: "not-an-id" })).toEqual({
      kind: "unavailable",
    });
    const other = setup(
      { bytes: png },
      { storageProviderId: providerIdSchema.parse("other-provider") },
    );
    expect(
      await other.service.validate({ assetId: other.subject.assetId }),
    ).toEqual({
      kind: "provider-mismatch",
    });
    expect(other.storage.reads).toHaveLength(0);
    expect(subject.assetId).toBeTruthy();
  });

  it("leaves the asset pending when storage fails or returns non-binary data", async () => {
    const failing = setup(new ObjectStorageError("provider-failure", "down"));
    await expect(
      failing.service.validate({ assetId: failing.subject.assetId }),
    ).rejects.toThrow("down");
    expect(failing.repository.recorded).toHaveLength(0);
    const odd = setup({ bytes: png, body: ["text"] });
    await expect(
      odd.service.validate({ assetId: odd.subject.assetId }),
    ).rejects.toThrow("non-binary");
    expect(odd.repository.recorded).toHaveLength(0);
  });
});
