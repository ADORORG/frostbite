import { describe, expect, it } from "vitest";

import { createJpeg, createWebp, imageFixtureSize } from "../src/images.ts";

describe("JPEG and WebP fixtures", () => {
  it("is a JPEG of the stated size, found in its start-of-frame marker", () => {
    const jpeg = createJpeg();
    expect([...jpeg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect([...jpeg.subarray(-2)]).toEqual([0xff, 0xd9]);
    const frame = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
    expect(frame).toBeGreaterThan(0);
    expect([
      jpeg.readUInt16BE(frame + 7),
      jpeg.readUInt16BE(frame + 5),
    ]).toEqual([imageFixtureSize.width, imageFixtureSize.height]);
  });

  it("is a lossless WebP whose RIFF length matches its bytes, of the stated size", () => {
    const webp = createWebp();
    expect(webp.toString("latin1", 0, 4)).toBe("RIFF");
    expect(webp.toString("latin1", 8, 16)).toBe("WEBPVP8L");
    expect(webp.readUInt32LE(4)).toBe(webp.length - 8);
    // VP8L packs width-1 and height-1 as two 14-bit values after the signature byte.
    const bits = webp.readUInt32LE(21);
    expect([(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]).toEqual([
      imageFixtureSize.width,
      imageFixtureSize.height,
    ]);
  });

  it("returns a fresh buffer each time, so a test cannot corrupt another's bytes", () => {
    const first = createJpeg();
    first[0] = 0;
    expect(createJpeg()[0]).toBe(0xff);
    expect(createWebp()).not.toBe(createWebp());
  });
});
