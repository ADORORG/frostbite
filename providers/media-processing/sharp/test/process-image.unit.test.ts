import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { makeImage } from "./support/images.ts";
import { run } from "./support/run-processor.ts";

describe("decoding and derivative generation", () => {
  it.each([
    ["png", { format: "png" }],
    ["jpeg", { format: "jpeg" }],
    ["lossy webp", { format: "webp" }],
    ["lossless webp", { format: "webp", lossless: true }],
    ["png with alpha", { alpha: true, format: "png" }],
  ] as const)(
    "produces a thumbnail and a preview from %s",
    async (_name, options) => {
      const bytes = await makeImage({
        ...options,
        height: 1_000,
        width: 2_000,
      });
      const result = await run(bytes, 2_000, 1_000);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(
        result.derivatives.map(({ kind, width, height }) => [
          kind,
          width,
          height,
        ]),
      ).toEqual([
        ["thumbnail", 256, 128],
        ["preview", 1_024, 512],
      ]);
      for (const derivative of result.derivatives) {
        const metadata = await sharp(derivative.bytes).metadata();
        expect([metadata.format, metadata.width, metadata.height]).toEqual([
          "webp",
          derivative.width,
          derivative.height,
        ]);
      }
    },
  );

  it("never enlarges an image smaller than the derivative size", async () => {
    const bytes = await makeImage({ format: "png", height: 50, width: 100 });
    const result = await run(bytes, 100, 50);
    expect(result).toMatchObject({
      derivatives: [
        { height: 50, kind: "thumbnail", width: 100 },
        { height: 50, kind: "preview", width: 100 },
      ],
      ok: true,
    });
  });

  it("applies EXIF orientation to the output while confirming the declared size", async () => {
    const bytes = await makeImage({
      format: "jpeg",
      height: 200,
      orientation: 6,
      width: 400,
    });
    const result = await run(bytes, 400, 200);
    expect(result).toMatchObject({
      derivatives: [
        { height: 256, width: 128 },
        { height: 400, width: 200 },
      ],
      ok: true,
    });
  });

  it("keeps transparency", async () => {
    const bytes = await makeImage({
      alpha: true,
      format: "png",
      height: 40,
      width: 40,
    });
    const result = await run(bytes, 40, 40);
    if (!result.ok) throw new Error("expected derivatives");
    expect(
      (await sharp(result.derivatives[0]?.bytes).metadata()).hasAlpha,
    ).toBe(true);
  });

  it("strips source metadata from derivatives", async () => {
    const source = await sharp(
      await makeImage({ format: "jpeg", height: 60, width: 60 }),
    )
      .withExif({ IFD0: { Copyright: "secret-copyright-marker" } })
      .jpeg()
      .toBuffer();
    expect(source.includes("secret-copyright-marker")).toBe(true);
    const result = await run(source, 60, 60);
    if (!result.ok) throw new Error("expected derivatives");
    for (const derivative of result.derivatives) {
      expect(
        Buffer.from(derivative.bytes).includes("secret-copyright-marker"),
      ).toBe(false);
      expect((await sharp(derivative.bytes).metadata()).exif).toBeUndefined();
    }
  });

  it("honors the requested quality", async () => {
    const bytes = await makeImage({ format: "png", height: 300, width: 300 });
    const low = await run(bytes, 300, 300, { quality: 10 });
    const high = await run(bytes, 300, 300, { quality: 95 });
    if (!low.ok || !high.ok) throw new Error("expected derivatives");
    expect(high.derivatives[1]?.bytes.length).toBeGreaterThan(
      low.derivatives[1]?.bytes.length ?? 0,
    );
  });
});
