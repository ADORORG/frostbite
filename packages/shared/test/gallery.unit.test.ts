import { describe, expect, it } from "vitest";

import {
  decodeGalleryCursor,
  encodeGalleryCursor,
  galleryCursorSchema,
  galleryPictureHref,
} from "../src/games/gallery.ts";

const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";

describe("the gallery's cursor", () => {
  it("carries the time and the claim to start after, and comes back the same", () => {
    const completedAt = new Date("2026-10-16T12:34:56.789Z");
    const text = encodeGalleryCursor({ claimId, completedAt });
    expect(text).toBe(`2026-10-16T12:34:56.789Z_${claimId}`);
    expect(galleryCursorSchema.safeParse(text).success).toBe(true);
    expect(decodeGalleryCursor(text)).toEqual({ claimId, completedAt });
  });

  it.each([
    "",
    "nonsense",
    `2026-10-16T12:00:00.000Z_not-a-uuid`,
    `2026-13-45T99:99:99.000Z_${claimId}`,
    `'; drop table x;--_${claimId}`,
  ])("refuses %j, so nothing odd reaches the database", (text) => {
    expect(decodeGalleryCursor(text)).toBeNull();
  });

  it("asks for a picture by the claim alone", () => {
    expect(galleryPictureHref(claimId)).toBe(
      `/api/v1/games/gallery/picture?claimId=${claimId}`,
    );
  });
});
