import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { detectMediaType } from "../src/signature.ts";
import { validateImage } from "../src/validate.ts";
import { pngWithHeader } from "./support/builders.ts";
import { fixture, text } from "./support/files.ts";

const limits = { maxDimension: 100, maxPixels: 5_000 };

describe("signature detection", () => {
  it.each([
    ["real-rgb.png", "image/png"],
    ["real-baseline.jpg", "image/jpeg"],
    ["real-lossy.webp", "image/webp"],
  ])("detects %s from its bytes", (name, mediaType) => {
    expect(detectMediaType(fixture(name))).toBe(mediaType);
  });

  it.each([
    ["empty", new Uint8Array()],
    ["short PNG prefix", Uint8Array.of(0x89, 0x50, 0x4e)],
    ["JPEG start without a marker", Uint8Array.of(0xff, 0xd8, 0x00, 0x00)],
    ["GIF", text("GIF89a......")],
    ["SVG", text("<svg xmlns='http://www.w3.org/2000/svg'/>")],
    ["HTML", text("<!doctype html><script>1</script>")],
    ["RIFF that is not WebP", text("RIFF....WAVEfmt ")],
    ["short RIFF", text("RIFF")],
  ])("does not detect %s", (_name, bytes) => {
    expect(detectMediaType(bytes)).toBeNull();
  });
});

describe("image validation", () => {
  it("returns geometry, size, and an independently verifiable SHA-256", () => {
    const bytes = fixture("real-rgb.png");
    expect(
      validateImage({ bytes, declaredMediaType: "image/png", limits }),
    ).toEqual({
      byteLength: bytes.length,
      height: 5,
      mediaType: "image/png",
      ok: true,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: 7,
    });
  });

  it("rejects a declared type that differs from the detected format", () => {
    expect(
      validateImage({
        bytes: fixture("real-rgb.png"),
        declaredMediaType: "image/jpeg",
        limits,
      }),
    ).toEqual({ ok: false, reason: "media-type-mismatch" });
  });

  it("rejects unrecognized content regardless of the declared type", () => {
    expect(
      validateImage({
        bytes: text("<svg/>"),
        declaredMediaType: "image/png",
        limits,
      }),
    ).toEqual({ ok: false, reason: "unsupported-format" });
  });

  it("propagates structural rejection before applying limits", () => {
    const bytes = fixture("real-rgb.png").subarray(0, 40);
    expect(
      validateImage({ bytes, declaredMediaType: "image/png", limits }),
    ).toEqual({ ok: false, reason: "malformed" });
  });

  it("accepts the exact dimension and pixel limits and rejects one past them", () => {
    const check = (width: number, height: number, bounds = limits) =>
      validateImage({
        bytes: pngWithHeader(width, height),
        declaredMediaType: "image/png",
        limits: bounds,
      });
    expect(check(100, 50)).toMatchObject({ ok: true });
    expect(check(101, 1)).toEqual({ ok: false, reason: "dimensions-exceeded" });
    expect(check(1, 101)).toEqual({ ok: false, reason: "dimensions-exceeded" });
    expect(check(100, 51)).toEqual({ ok: false, reason: "pixels-exceeded" });
  });
});
