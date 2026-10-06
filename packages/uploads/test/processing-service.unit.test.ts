import { createUuidV7, uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { resolveDerivativePolicy } from "@ador/shared/uploads";
import { describe, expect, it } from "vitest";

import { providerId } from "./support/images.ts";
import {
  preview,
  setup,
  sha,
  source,
  thumbnail,
} from "./support/processing-setup.ts";

describe("asset processing activity", () => {
  it("stores content-addressed private derivatives and records them", async () => {
    const { service, storage, subject } = setup();
    const result = await service.process({ assetId: subject.assetId });
    const key = (kind: string, bytes: Uint8Array) =>
      `derivatives/${subject.assetId}/webp-v1/${kind}-${sha(bytes)}.webp`;
    expect(result).toMatchObject({
      kind: "recorded",
      outcome: {
        derivatives: [
          {
            byteLength: 3,
            contentSha256: sha(thumbnail),
            contentType: "image/webp",
            height: 5,
            kind: "thumbnail",
            objectKey: key("thumbnail", thumbnail),
            specVersion: "webp-v1",
            storageProviderId: providerId,
            width: 7,
          },
          {
            byteLength: 4,
            contentSha256: sha(preview),
            kind: "preview",
            objectKey: key("preview", preview),
          },
        ],
        state: "processed",
      },
    });
    expect(
      storage.writes.map(
        ({
          bytes,
          contentLength,
          contentType,
          ifAbsent,
          key: written,
          scope,
        }) => [
          [...bytes],
          contentLength,
          contentType,
          ifAbsent,
          written,
          scope,
        ],
      ),
    ).toEqual([
      [
        [1, 2, 3],
        3,
        "image/webp",
        true,
        key("thumbnail", thumbnail),
        "private",
      ],
      [[4, 5, 6, 7], 4, "image/webp", true, key("preview", preview), "private"],
    ]);
  });

  it("asks the decoder for the policy sizes, quality, limits, and recorded dimensions", async () => {
    const policy = resolveDerivativePolicy({
      previewMaxSide: 2_000,
      thumbnailMaxSide: 100,
      webpQuality: 55,
    });
    const { processor, service, subject } = setup({ policy });
    await service.process({ assetId: subject.assetId });
    expect(processor.inputs).toHaveLength(1);
    expect(processor.inputs[0]).toMatchObject({
      derivatives: [
        { kind: "thumbnail", maxSide: 100 },
        { kind: "preview", maxSide: 2_000 },
      ],
      expected: { height: 5, width: 7 },
      limits: { maxDimension: 8_192, maxPixels: 40_000_000 },
      quality: 55,
    });
    expect([...(processor.inputs[0]?.bytes ?? [])]).toEqual([...source]);
  });

  it("puts the spec version in every derivative key", async () => {
    const policy = resolveDerivativePolicy({ specVersion: "webp-v2" });
    const { service, storage, subject } = setup({ policy });
    await service.process({ assetId: subject.assetId });
    expect(storage.writes.every(({ key }) => key.includes("/webp-v2/"))).toBe(
      true,
    );
  });

  it.each([
    "decode-failed",
    "decoded-size-mismatch",
    "processing-limit-exceeded",
  ] as const)(
    "records a %s rejection without writing anything",
    async (reason) => {
      const { service, storage, subject } = setup({
        processor: { ok: false, reason },
      });
      expect(await service.process({ assetId: subject.assetId })).toEqual({
        kind: "recorded",
        outcome: { reason, state: "unprocessable" },
      });
      expect(storage.writes).toHaveLength(0);
    },
  );

  it.each([
    [
      "different bytes of the same length",
      { source: new Uint8Array(source.length).fill(9) },
    ],
    ["a longer object", { source: Uint8Array.from([...source, 0]) }],
    ["a shorter object", { source: source.subarray(0, source.length - 1) }],
  ])(
    "rejects %s as changed after validation, without decoding",
    async (_name, options) => {
      const { processor, service, subject } = setup(options);
      expect(await service.process({ assetId: subject.assetId })).toEqual({
        kind: "recorded",
        outcome: { reason: "content-changed", state: "unprocessable" },
      });
      expect(processor.inputs).toHaveLength(0);
    },
  );

  it("replays a final outcome without reading storage or decoding", async () => {
    const { processor, service, storage, subject } = setup();
    await service.process({ assetId: subject.assetId });
    const reads = storage.reads.length;
    expect(await service.process({ assetId: subject.assetId })).toMatchObject({
      kind: "replayed",
      outcome: { state: "processed" },
    });
    expect(storage.reads).toHaveLength(reads);
    expect(processor.inputs).toHaveLength(1);
  });

  it("converges when two runs race", async () => {
    const { repository, service, subject } = setup();
    const results = await Promise.all([
      service.process({ assetId: subject.assetId }),
      service.process({ assetId: subject.assetId }),
    ]);
    expect(results.map(({ kind }) => kind).sort()).toEqual([
      "recorded",
      "replayed",
    ]);
    expect(repository.recorded).toHaveLength(2);
  });

  it("reports assets that are unknown, not yet validated, or bound to another provider", async () => {
    const { service, subject } = setup();
    expect(await service.process({ assetId: createUuidV7() })).toEqual({
      kind: "unavailable",
    });
    expect(await service.process({ assetId: "nope" })).toEqual({
      kind: "unavailable",
    });
    const waiting = setup({
      initial: { kind: "not-ready", state: "pending-validation" },
    });
    expect(
      await waiting.service.process({ assetId: waiting.subject.assetId }),
    ).toEqual({ kind: "not-ready" });
    expect(waiting.storage.reads).toHaveLength(0);
    const other = setup({
      subject: { storageProviderId: providerIdSchema.parse("other-provider") },
    });
    expect(
      await other.service.process({ assetId: other.subject.assetId }),
    ).toEqual({ kind: "provider-mismatch" });
    expect(other.storage.reads).toHaveLength(0);
    expect(uuidV7Schema.safeParse(subject.assetId).success).toBe(true);
  });
});
