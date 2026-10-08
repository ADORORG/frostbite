import { crc32, inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { createDecodablePng, createUndecodablePng } from "../src/png.ts";

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunks(png: Buffer) {
  const found: { data: Buffer; type: string }[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    found.push({
      data: png.subarray(offset + 8, offset + 8 + length),
      type: png.toString("latin1", offset + 4, offset + 8),
    });
    offset += 12 + length;
  }
  return found;
}

describe("PNG fixtures", () => {
  it("builds a well-framed PNG with the requested size", () => {
    const png = createDecodablePng(7, 5);
    expect([...png.subarray(0, 8)]).toEqual(signature);
    expect(chunks(png).map(({ type }) => type)).toEqual([
      "IHDR",
      "IDAT",
      "IEND",
    ]);
    const [ihdr] = chunks(png);
    expect([ihdr?.data.readUInt32BE(0), ihdr?.data.readUInt32BE(4)]).toEqual([
      7, 5,
    ]);
  });

  it("carries exactly one filtered scanline of pixels per row", () => {
    const png = createDecodablePng(7, 5);
    const idat = chunks(png).find(({ type }) => type === "IDAT");
    expect(inflateSync(idat?.data ?? Buffer.alloc(0)).length).toBe(
      (1 + 7 * 3) * 5,
    );
  });

  it("fills the image with a gradient, so a decoder produces visible, varied pixels", () => {
    const idat = chunks(createDecodablePng(5, 4)).find(
      ({ type }) => type === "IDAT",
    );
    const raw = inflateSync(idat?.data ?? Buffer.alloc(0));
    const pixel = (x: number, y: number) => [
      ...raw.subarray(y * 16 + 1 + x * 3, y * 16 + 4 + x * 3),
    ];
    expect(pixel(0, 0)).toEqual([0, 0, 160]);
    expect(pixel(4, 0)).toEqual([255, 0, 160]);
    expect(pixel(0, 3)).toEqual([0, 255, 160]);
  });

  it("checks every chunk against its CRC", () => {
    for (const png of [createDecodablePng(4, 4), createUndecodablePng(4, 4)])
      for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset);
        const body = png.subarray(offset + 4, offset + 8 + length);
        const stored = png.readUInt32BE(offset + 8 + length);
        expect(stored).toBe(crc32(body));
        offset += 12 + length;
      }
  });

  it("builds a structurally valid PNG whose pixel data cannot be inflated", () => {
    const png = createUndecodablePng(4, 4);
    expect(chunks(png).map(({ type }) => type)).toEqual([
      "IHDR",
      "IDAT",
      "IEND",
    ]);
    const idat = chunks(png).find(({ type }) => type === "IDAT");
    expect(() => inflateSync(idat?.data ?? Buffer.alloc(0))).toThrow();
  });
});
