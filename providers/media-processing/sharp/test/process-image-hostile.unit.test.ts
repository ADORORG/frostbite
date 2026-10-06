import { describe, expect, it } from "vitest";

import { buildPng, makeImage, pngChunks } from "./support/images.ts";
import { run } from "./support/run-processor.ts";

describe("hostile and inconsistent inputs", () => {
  it("rejects a header that disagrees with the recorded dimensions", async () => {
    const bytes = await makeImage({ format: "png", height: 50, width: 100 });
    expect(await run(bytes, 100, 51)).toEqual({
      ok: false,
      reason: "decoded-size-mismatch",
    });
    expect(await run(bytes, 101, 50)).toEqual({
      ok: false,
      reason: "decoded-size-mismatch",
    });
  });

  it("rejects a well-formed PNG whose pixel stream is truncated", async () => {
    const chunks = pngChunks(
      await makeImage({ format: "png", height: 200, width: 200 }),
    );
    const tampered = chunks.map((chunk) =>
      chunk.type === "IDAT"
        ? { ...chunk, data: chunk.data.subarray(0, 20) }
        : chunk,
    );
    expect(await run(buildPng(tampered), 200, 200)).toEqual({
      ok: false,
      reason: "decode-failed",
    });
  });

  it("rejects a well-formed PNG whose pixel stream is corrupt", async () => {
    const chunks = pngChunks(
      await makeImage({ format: "png", height: 200, width: 200 }),
    );
    const tampered = chunks.map((chunk) =>
      chunk.type === "IDAT"
        ? {
            ...chunk,
            data: Buffer.from(
              chunk.data.map((byte, index) => (index > 8 ? byte ^ 0x5a : byte)),
            ),
          }
        : chunk,
    );
    expect(await run(buildPng(tampered), 200, 200)).toEqual({
      ok: false,
      reason: "decode-failed",
    });
  });

  it("rejects an IHDR that disagrees with its pixel stream and decodes only the declared rows", async () => {
    const source = pngChunks(
      await makeImage({ format: "png", height: 40, width: 40 }),
    );
    const withHeader = (width: number, height: number) =>
      buildPng(
        source.map((chunk) => {
          if (chunk.type !== "IHDR") return chunk;
          const data = Buffer.from(chunk.data);
          data.writeUInt32BE(width, 0);
          data.writeUInt32BE(height, 4);
          return { ...chunk, data };
        }),
      );
    expect(await run(withHeader(10, 10), 10, 10)).toEqual({
      ok: false,
      reason: "decode-failed",
    });
    expect(await run(withHeader(80, 80), 80, 80)).toEqual({
      ok: false,
      reason: "decode-failed",
    });
    // Fewer declared rows than the stream holds: libvips decodes exactly the declared size.
    expect(await run(withHeader(40, 20), 40, 20)).toMatchObject({
      derivatives: [
        { height: 20, width: 40 },
        { height: 20, width: 40 },
      ],
      ok: true,
    });
  });

  it("rejects a corrupt lossless WebP payload", async () => {
    const bytes = Buffer.from(
      await makeImage({
        format: "webp",
        height: 120,
        lossless: true,
        width: 120,
      }),
    );
    for (let index = 24; index < bytes.length; index += 1)
      bytes[index] = (bytes[index] ?? 0) ^ 0xff;
    expect((await run(bytes, 120, 120)).ok).toBe(false);
  });

  it("rejects a JPEG whose scan data is cut short", async () => {
    const bytes = await makeImage({ format: "jpeg", height: 300, width: 300 });
    const cut = Buffer.concat([
      bytes.subarray(0, bytes.length - 400),
      Buffer.from([0xff, 0xd9]),
    ]);
    expect(await run(cut, 300, 300)).toEqual({
      ok: false,
      reason: "decode-failed",
    });
  });

  it("enforces the pixel limit while decoding", async () => {
    const bytes = await makeImage({ format: "png", height: 100, width: 100 });
    expect(
      await run(bytes, 100, 100, {
        limits: { maxDimension: 8_192, maxPixels: 9_999 },
      }),
    ).toEqual({
      ok: false,
      reason: "decode-failed",
    });
  });

  it("rejects arbitrary bytes", async () => {
    expect(await run(Buffer.from("not an image at all"), 1, 1)).toEqual({
      ok: false,
      reason: "decode-failed",
    });
  });
});
