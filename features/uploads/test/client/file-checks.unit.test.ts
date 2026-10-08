import { assetRejectionReasons, uploadPurposes } from "@ador/shared/uploads";
import { describe, expect, it } from "vitest";

import { checkFile } from "../../src/client/file-checks.ts";
import {
  assetRejectionCopy,
  describeFileRejection,
} from "../../src/client/rejection-copy.ts";

describe("local file checks", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])(
    "accepts %s within the limit",
    (type) => {
      expect(checkFile({ size: 1_000, type }, "creator-avatar")).toEqual({
        file: { byteLength: 1_000, contentType: type },
        ok: true,
      });
    },
  );

  it("accepts a file of exactly the purpose limit and refuses one byte over", () => {
    const limit = 5_000_000;
    expect(
      checkFile({ size: limit, type: "image/png" }, "creator-avatar").ok,
    ).toBe(true);
    expect(
      checkFile({ size: limit + 1, type: "image/png" }, "creator-avatar"),
    ).toEqual({
      ok: false,
      rejection: { kind: "too-large", maxBytes: limit },
    });
  });

  it("applies the limit of the chosen purpose", () => {
    expect(
      checkFile({ size: 6_000_000, type: "image/png" }, "creator-avatar").ok,
    ).toBe(false);
    expect(
      checkFile({ size: 6_000_000, type: "image/png" }, "collection-artwork")
        .ok,
    ).toBe(true);
    expect(
      checkFile({ size: 11, type: "image/png" }, "creator-avatar", {
        "collection-artwork": 1,
        "collection-banner": 1,
        "collection-item-artwork": 1,
        "creator-avatar": 10,
      }),
    ).toMatchObject({ rejection: { maxBytes: 10 } });
  });

  it.each([
    ["an empty file", { size: 0, type: "image/png" }, { kind: "empty" }],
    ["a negative size", { size: -1, type: "image/png" }, { kind: "empty" }],
    [
      "a gif",
      { size: 5, type: "image/gif" },
      { contentType: "image/gif", kind: "unsupported-type" },
    ],
    [
      "a missing type",
      { size: 5, type: "" },
      { contentType: "", kind: "unsupported-type" },
    ],
    [
      "a svg",
      { size: 5, type: "image/svg+xml" },
      { contentType: "image/svg+xml", kind: "unsupported-type" },
    ],
  ])("rejects %s", (_name, file, rejection) => {
    expect(checkFile(file, "collection-artwork")).toEqual({
      ok: false,
      rejection,
    });
  });

  it("checks every purpose the platform defines", () => {
    for (const purpose of uploadPurposes)
      expect(checkFile({ size: 1, type: "image/png" }, purpose).ok).toBe(true);
  });
});

describe("rejection copy", () => {
  it("explains every server-side rejection reason without leaking internals", () => {
    expect(Object.keys(assetRejectionCopy).sort()).toEqual(
      [...assetRejectionReasons].sort(),
    );
    for (const text of Object.values(assetRejectionCopy)) {
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/sharp|libvips|stack|exception|sha256/i);
    }
  });

  it("describes local rejections, including the limit in megabytes", () => {
    expect(describeFileRejection({ kind: "empty" })).toMatch(/empty/i);
    expect(
      describeFileRejection({ contentType: "x", kind: "unsupported-type" }),
    ).toMatch(/PNG, JPEG, and WebP/);
    expect(
      describeFileRejection({ kind: "too-large", maxBytes: 25_000_000 }),
    ).toContain("25 MB");
  });
});
