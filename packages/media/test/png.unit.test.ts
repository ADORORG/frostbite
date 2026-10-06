import { describe, expect, it } from "vitest";

import { parsePng } from "../src/png.ts";
import {
  pngChunk,
  pngFromChunks,
  pngHeader,
  pngWithHeader,
} from "./support/builders.ts";
import { concat, fixture } from "./support/files.ts";

const malformed = { ok: false, reason: "malformed" };
const idat = pngChunk("IDAT", Uint8Array.of(0));
const iend = pngChunk("IEND", new Uint8Array());

describe("PNG structure", () => {
  it.each(["real-rgb.png", "real-rgba.png"])("accepts %s", (name) => {
    expect(parsePng(fixture(name))).toEqual({
      height: 5,
      mediaType: "image/png",
      ok: true,
      width: 7,
    });
  });

  it("rejects an animated PNG", () => {
    expect(parsePng(fixture("real-animated.png"))).toEqual({
      ok: false,
      reason: "animation-unsupported",
    });
  });

  it("rejects every truncation of a real file", () => {
    const bytes = fixture("real-rgba.png");
    for (let length = 8; length < bytes.length; length += 1)
      expect(parsePng(bytes.subarray(0, length)), `length ${length}`).toEqual(
        malformed,
      );
  });

  it("rejects any single corrupted byte after the signature", () => {
    const bytes = fixture("real-rgba.png");
    for (let index = 8; index < bytes.length; index += 1) {
      const copy = bytes.slice();
      copy[index] = (copy[index] ?? 0) ^ 0xff;
      expect(parsePng(copy), `byte ${index}`).toEqual(malformed);
    }
  });

  it("rejects bytes after IEND", () => {
    expect(parsePng(concat(fixture("real-rgb.png"), Uint8Array.of(0)))).toEqual(
      malformed,
    );
  });

  it.each([
    ["no header first", pngFromChunks(idat, iend)],
    [
      "short header",
      pngFromChunks(pngChunk("IHDR", new Uint8Array(12)), idat, iend),
    ],
    [
      "header one byte short with plausible dimensions",
      pngFromChunks(
        pngChunk("IHDR", Uint8Array.of(0, 0, 0, 5, 0, 0, 0, 5, 8, 2, 0, 0)),
        idat,
        iend,
      ),
    ],
    [
      "header one byte long with plausible dimensions",
      pngFromChunks(
        pngChunk(
          "IHDR",
          Uint8Array.of(0, 0, 0, 5, 0, 0, 0, 5, 8, 2, 0, 0, 0, 0),
        ),
        idat,
        iend,
      ),
    ],
    [
      "first chunk of header size but another type",
      pngFromChunks(
        pngChunk("tEXt", Uint8Array.of(0, 0, 0, 5, 0, 0, 0, 5, 8, 2, 0, 0, 0)),
        idat,
        iend,
      ),
    ],
    [
      "duplicate header",
      pngFromChunks(pngHeader(1, 1), pngHeader(1, 1), idat, iend),
    ],
    ["zero width", pngWithHeader(0, 5)],
    ["zero height", pngWithHeader(5, 0)],
    ["no image data", pngFromChunks(pngHeader(1, 1), iend)],
    [
      "non-empty IEND",
      pngFromChunks(pngHeader(1, 1), idat, pngChunk("IEND", Uint8Array.of(1))),
    ],
    ["no IEND", pngFromChunks(pngHeader(1, 1), idat)],
    [
      "oversized chunk length",
      concat(
        pngFromChunks(pngHeader(1, 1)),
        Uint8Array.of(
          0xff,
          0xff,
          0xff,
          0xff,
          0x49,
          0x44,
          0x41,
          0x54,
          0,
          0,
          0,
          0,
        ),
      ),
    ],
  ])("rejects %s", (_name, bytes) => {
    expect(parsePng(bytes)).toEqual(malformed);
  });

  it("reports declared dimensions of a forged but well-formed header", () => {
    expect(parsePng(pngWithHeader(60_000, 60_000))).toMatchObject({
      height: 60_000,
      ok: true,
      width: 60_000,
    });
  });
});
