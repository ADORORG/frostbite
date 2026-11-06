import { defaultUploadPolicy } from "@frostbite/shared/uploads";
import { describe, expect, it } from "vitest";

import { validateImage } from "../src/validate.ts";
import { pngWithHeader } from "./support/builders.ts";
import { concat, fixture, text } from "./support/files.ts";

const limits = {
  maxDimension: defaultUploadPolicy.maxImageDimension,
  maxPixels: defaultUploadPolicy.maxImagePixels,
};
const reasonFor = (
  bytes: Uint8Array,
  declaredMediaType: "image/png" | "image/jpeg" | "image/webp",
) => {
  const result = validateImage({ bytes, declaredMediaType, limits });
  return result.ok ? "accepted" : result.reason;
};

describe("beta media policy against real and hostile files", () => {
  it.each([
    ["real-rgb.png", "image/png"],
    ["real-rgba.png", "image/png"],
    ["real-baseline.jpg", "image/jpeg"],
    ["real-progressive.jpg", "image/jpeg"],
    ["real-lossy.webp", "image/webp"],
    ["real-lossless.webp", "image/webp"],
    ["real-alpha.webp", "image/webp"],
    ["real-alpha-lossy.webp", "image/webp"],
  ] as const)("accepts the encoder-produced %s", (name, mediaType) => {
    expect(reasonFor(fixture(name), mediaType)).toBe("accepted");
  });

  it("rejects decompression-bomb headers that are structurally well formed", () => {
    expect(reasonFor(pngWithHeader(60_000, 60_000), "image/png")).toBe(
      "dimensions-exceeded",
    );
    expect(reasonFor(pngWithHeader(8_192, 8_192), "image/png")).toBe(
      "pixels-exceeded",
    );
    expect(reasonFor(pngWithHeader(8_192, 4_883), "image/png")).toBe(
      "pixels-exceeded",
    );
    expect(reasonFor(pngWithHeader(8_192, 4_882), "image/png")).toBe(
      "accepted",
    );
  });

  it("rejects polyglots that append a second payload to a valid image", () => {
    const payloads = [
      text("<html><script>alert(1)</script></html>"),
      text("PK\u0003\u0004zip"),
      fixture("real-baseline.jpg"),
    ];
    for (const payload of payloads) {
      expect(
        reasonFor(concat(fixture("real-rgb.png"), payload), "image/png"),
      ).toBe("malformed");
      expect(
        reasonFor(concat(fixture("real-baseline.jpg"), payload), "image/jpeg"),
      ).toBe("malformed");
      expect(
        reasonFor(concat(fixture("real-lossy.webp"), payload), "image/webp"),
      ).toBe("malformed");
    }
  });

  it("rejects spoofed types in every direction", () => {
    const files = {
      "image/png": fixture("real-rgb.png"),
      "image/jpeg": fixture("real-baseline.jpg"),
      "image/webp": fixture("real-lossy.webp"),
    } as const;
    for (const [actual, bytes] of Object.entries(files))
      for (const declared of Object.keys(files) as (keyof typeof files)[])
        if (declared !== actual)
          expect(reasonFor(bytes, declared), `${actual} as ${declared}`).toBe(
            "media-type-mismatch",
          );
  });

  it("rejects formats outside the beta scope and animated images", () => {
    for (const bytes of [
      text("GIF89a\u0001\u0000\u0001\u0000"),
      text("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
      text("MZ\u0090\u0000\u0003"),
      new Uint8Array(),
    ])
      expect(reasonFor(bytes, "image/png")).toBe("unsupported-format");
    expect(reasonFor(fixture("real-animated.png"), "image/png")).toBe(
      "animation-unsupported",
    );
    expect(reasonFor(fixture("real-animated.webp"), "image/webp")).toBe(
      "animation-unsupported",
    );
  });

  it("tolerates large metadata segments without trusting them for geometry", () => {
    const jpeg = fixture("real-baseline.jpg");
    const comment = Uint8Array.of(0xff, 0xfe, 0xff, 0xff);
    const withComment = concat(
      jpeg.subarray(0, 2),
      comment,
      new Uint8Array(0xffff - 2),
      jpeg.subarray(2),
    );
    expect(
      validateImage({
        bytes: withComment,
        declaredMediaType: "image/jpeg",
        limits,
      }),
    ).toMatchObject({ height: 5, ok: true, width: 7 });
  });
});
