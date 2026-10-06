import { describe, expect, it } from "vitest";

import { parseWebp } from "../src/webp.ts";
import { riff, webpChunk } from "./support/builders.ts";
import { concat, fixture, text } from "./support/files.ts";

const malformed = { ok: false, reason: "malformed" };
const animatedResult = { ok: false, reason: "animation-unsupported" };

function lossyChunk(
  width: number,
  height: number,
  startCode = [0x9d, 0x01, 0x2a],
) {
  const data = new Uint8Array(10);
  data.set(startCode, 3);
  new DataView(data.buffer).setUint16(6, width, true);
  new DataView(data.buffer).setUint16(8, height, true);
  return webpChunk("VP8 ", data);
}

function losslessChunk(width: number, height: number, signature = 0x2f) {
  const data = new Uint8Array(5);
  data[0] = signature;
  new DataView(data.buffer).setUint32(
    1,
    (width - 1) | ((height - 1) << 14),
    true,
  );
  return webpChunk("VP8L", data);
}

function extended(width: number, height: number, flags = 0) {
  const data = new Uint8Array(10);
  data[0] = flags;
  for (const [at, value] of [
    [4, width - 1],
    [7, height - 1],
  ] as const)
    for (let byte = 0; byte < 3; byte += 1)
      data[at + byte] = (value >> (8 * byte)) & 0xff;
  return webpChunk("VP8X", data);
}

describe("WebP structure", () => {
  it.each([
    "real-lossy.webp",
    "real-lossless.webp",
    "real-alpha.webp",
    "real-alpha-lossy.webp",
  ])("accepts %s", (name) => {
    expect(parseWebp(fixture(name))).toEqual({
      height: 5,
      mediaType: "image/webp",
      ok: true,
      width: 7,
    });
  });

  it("rejects animation by flag, by chunk, and by real file", () => {
    expect(parseWebp(fixture("real-animated.webp"))).toEqual(animatedResult);
    expect(parseWebp(riff(extended(7, 5, 0x02), losslessChunk(7, 5)))).toEqual(
      animatedResult,
    );
    expect(parseWebp(riff(webpChunk("ANMF", new Uint8Array(16))))).toEqual(
      animatedResult,
    );
  });

  it("rejects every truncation of a real file", () => {
    for (const name of ["real-lossy.webp", "real-alpha-lossy.webp"]) {
      const bytes = fixture(name);
      for (let length = 12; length < bytes.length; length += 1)
        expect(
          parseWebp(bytes.subarray(0, length)),
          `${name} ${length}`,
        ).toEqual(malformed);
    }
  });

  it("rejects trailing bytes and a forged RIFF size", () => {
    const bytes = fixture("real-lossy.webp");
    expect(parseWebp(concat(bytes, Uint8Array.of(0, 0)))).toEqual(malformed);
    const forged = bytes.slice();
    new DataView(forged.buffer).setUint32(4, bytes.length, true);
    expect(parseWebp(forged)).toEqual(malformed);
  });

  it("accepts odd-sized chunks with padding and ignores unknown metadata chunks", () => {
    expect(
      parseWebp(
        riff(
          extended(3, 2),
          webpChunk("EXIF", Uint8Array.of(1, 2, 3)),
          losslessChunk(3, 2),
        ),
      ),
    ).toMatchObject({ height: 2, ok: true, width: 3 });
  });

  it.each([
    ["no chunks", riff()],
    [
      "unknown first chunk",
      riff(webpChunk("EXIF", new Uint8Array(4)), losslessChunk(2, 2)),
    ],
    ["extended header without an image", riff(extended(2, 2))],
    ["extended header not first", riff(losslessChunk(2, 2), extended(2, 2))],
    ["short extended header", riff(webpChunk("VP8X", new Uint8Array(4)))],
    [
      "canvas width disagrees with image",
      riff(extended(9, 2), losslessChunk(2, 2)),
    ],
    [
      "canvas height disagrees with image",
      riff(extended(2, 9), losslessChunk(2, 2)),
    ],
    ["two image chunks", riff(losslessChunk(2, 2), losslessChunk(2, 2))],
    ["lossy start code wrong", riff(lossyChunk(2, 2, [0, 0, 0]))],
    [
      "lossy interframe",
      riff(
        webpChunk("VP8 ", Uint8Array.of(1, 0, 0, 0x9d, 1, 0x2a, 2, 0, 2, 0)),
      ),
    ],
    ["lossy chunk too short", riff(webpChunk("VP8 ", new Uint8Array(4)))],
    ["lossless signature wrong", riff(losslessChunk(2, 2, 0x2e))],
    ["lossless chunk too short", riff(webpChunk("VP8L", new Uint8Array(2)))],
    [
      "short lossy chunk with a valid prefix, last",
      riff(webpChunk("VP8 ", Uint8Array.of(0, 0, 0, 0x9d, 0x01, 0x2a))),
    ],
    [
      "short lossy chunk with a valid prefix, followed by another chunk",
      riff(
        webpChunk("VP8 ", Uint8Array.of(0, 0, 0, 0x9d, 0x01, 0x2a)),
        webpChunk("EXIF", Uint8Array.of(2, 0, 2, 0, 0, 0, 0, 0)),
      ),
    ],
    [
      "short lossless chunk with a valid signature, last",
      riff(webpChunk("VP8L", Uint8Array.of(0x2f))),
    ],
    [
      "short lossless chunk with a valid signature, followed by another chunk",
      riff(
        webpChunk("VP8L", Uint8Array.of(0x2f)),
        webpChunk("EXIF", Uint8Array.of(1, 0, 0, 0, 0, 0, 0, 0)),
      ),
    ],
    ["lossy zero width", riff(lossyChunk(0, 2))],
    [
      "chunk size past the end",
      concat(riff(), text("VP8L"), Uint8Array.of(0xff, 0, 0, 0)),
    ],
    ["truncated chunk header", concat(riff(), text("VP8"))],
  ])("rejects %s", (_name, bytes) => {
    const fixed = bytes.slice();
    new DataView(fixed.buffer).setUint32(4, fixed.length - 8, true);
    expect(parseWebp(fixed)).toEqual(malformed);
  });
});
