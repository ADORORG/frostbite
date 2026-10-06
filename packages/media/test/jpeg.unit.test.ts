import { describe, expect, it } from "vitest";

import { parseJpeg } from "../src/jpeg.ts";
import {
  jpegEnd,
  jpegFrame,
  jpegScan,
  jpegSegment,
  jpegStart,
} from "./support/builders.ts";
import { concat, fixture } from "./support/files.ts";

const malformed = { ok: false, reason: "malformed" };
const unsupported = { ok: false, reason: "unsupported-format" };
const build = (...parts: readonly Uint8Array[]) =>
  concat(jpegStart, ...parts, jpegEnd);

describe("JPEG structure", () => {
  it.each(["real-baseline.jpg", "real-progressive.jpg"])(
    "accepts %s",
    (name) => {
      expect(parseJpeg(fixture(name))).toEqual({
        height: 5,
        mediaType: "image/jpeg",
        ok: true,
        width: 7,
      });
    },
  );

  it("accepts fill bytes, restart markers, and stuffed entropy bytes", () => {
    expect(
      parseJpeg(
        build(
          Uint8Array.of(0xff),
          jpegSegment(0xfe, new Uint8Array(3)),
          jpegFrame(9, 4),
          jpegScan(),
        ),
      ),
    ).toMatchObject({ height: 4, ok: true, width: 9 });
  });

  it("accepts fill bytes before the marker that ends scan data", () => {
    expect(
      parseJpeg(
        concat(
          jpegStart,
          jpegFrame(2, 2),
          jpegScan(),
          Uint8Array.of(0xff, 0xff),
          jpegEnd,
        ),
      ),
    ).toMatchObject({ ok: true });
  });

  it("accepts fill bytes before a restart marker inside scan data", () => {
    expect(
      parseJpeg(
        concat(
          jpegStart,
          jpegFrame(2, 2),
          jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 63, 0)),
          Uint8Array.of(0x12, 0xff, 0xff, 0xd0, 0x34),
          jpegEnd,
        ),
      ),
    ).toMatchObject({ ok: true });
  });

  it("accepts standalone markers between segments", () => {
    expect(
      parseJpeg(
        build(
          Uint8Array.of(0xff, 0x01, 0xff, 0xd3),
          jpegFrame(2, 2),
          jpegScan(),
        ),
      ),
    ).toMatchObject({ ok: true });
  });

  it("accepts extended and progressive frame markers", () => {
    for (const marker of [0xc1, 0xc2])
      expect(
        parseJpeg(build(jpegFrame(2, 2, marker), jpegScan())),
      ).toMatchObject({ ok: true });
  });

  it("rejects every truncation of a real file", () => {
    for (const name of ["real-baseline.jpg", "real-progressive.jpg"]) {
      const bytes = fixture(name);
      for (let length = 3; length < bytes.length; length += 1)
        expect(
          parseJpeg(bytes.subarray(0, length)),
          `${name} ${length}`,
        ).toEqual(malformed);
    }
  });

  it("rejects bytes after EOI", () => {
    expect(
      parseJpeg(concat(fixture("real-baseline.jpg"), Uint8Array.of(0))),
    ).toEqual(malformed);
  });

  it.each([
    ["lossless frame", build(jpegFrame(2, 2, 0xc3), jpegScan())],
    ["arithmetic frame", build(jpegFrame(2, 2, 0xc9), jpegScan())],
  ])("rejects a %s as unsupported", (_name, bytes) => {
    expect(parseJpeg(bytes)).toEqual(unsupported);
  });

  it.each([
    ["no frame", build(jpegScan())],
    ["no scan", build(jpegFrame(2, 2))],
    ["scan before frame", build(jpegScan(), jpegFrame(2, 2))],
    ["zero width", build(jpegFrame(0, 2), jpegScan())],
    ["zero height", build(jpegFrame(2, 0), jpegScan())],
    ["duplicate frame", build(jpegFrame(2, 2), jpegFrame(2, 2), jpegScan())],
    ["no EOI", concat(jpegStart, jpegFrame(2, 2), jpegScan())],
    ["EOI before scan", concat(jpegStart, jpegFrame(2, 2), jpegEnd)],
    [
      "stray byte between segments",
      build(Uint8Array.of(0x12), jpegFrame(2, 2), jpegScan()),
    ],
    [
      "second start-of-image marker",
      build(
        Uint8Array.of(0xff, 0xd8, 0x00, 0x04, 0x01, 0x02),
        jpegFrame(2, 2),
        jpegScan(),
      ),
    ],
    [
      "null marker with a plausible length",
      build(
        Uint8Array.of(0xff, 0x00, 0x00, 0x04, 1, 2),
        jpegFrame(2, 2),
        jpegScan(),
      ),
    ],
    [
      "stray bytes that resemble a segment length",
      build(Uint8Array.of(0x12, 0x00, 0x04, 1, 2), jpegFrame(2, 2), jpegScan()),
    ],
    [
      "null marker",
      build(Uint8Array.of(0xff, 0x00), jpegFrame(2, 2), jpegScan()),
    ],
    [
      "segment length below two",
      build(Uint8Array.of(0xff, 0xe0, 0x00, 0x01), jpegFrame(2, 2), jpegScan()),
    ],
    [
      "segment past the end",
      concat(jpegStart, Uint8Array.of(0xff, 0xe0, 0x00, 0x20, 1)),
    ],
    [
      "missing length bytes",
      concat(jpegStart, Uint8Array.of(0xff, 0xe0, 0x00)),
    ],
    ["short frame", build(jpegSegment(0xc0, new Uint8Array(4)), jpegScan())],
    [
      "frame length disagrees with components",
      build(
        jpegSegment(0xc0, Uint8Array.of(8, 0, 2, 0, 2, 3, 1, 0x11, 0)),
        jpegScan(),
      ),
    ],
    [
      "zero components",
      build(jpegSegment(0xc0, Uint8Array.of(8, 0, 2, 0, 2, 0)), jpegScan()),
    ],
    [
      "scan header declaring length zero",
      build(jpegFrame(2, 2), Uint8Array.of(0xff, 0xda, 0x00, 0x00, 0x12, 0x34)),
    ],
    [
      "scan header declaring length one",
      build(jpegFrame(2, 2), Uint8Array.of(0xff, 0xda, 0x00, 0x01, 0x12, 0x34)),
    ],
    ["marker prefix at end", concat(jpegStart, Uint8Array.of(0xff))],
    [
      "scan data ends on a bare prefix",
      concat(
        jpegStart,
        jpegFrame(2, 2),
        jpegSegment(0xda, Uint8Array.of(1, 1, 0, 0, 63, 0)),
        Uint8Array.of(0x12, 0xff),
      ),
    ],
  ])("rejects %s", (_name, bytes) => {
    expect(parseJpeg(bytes)).toEqual(malformed);
  });
});
