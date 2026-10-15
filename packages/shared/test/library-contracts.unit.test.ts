import { describe, expect, it } from "vitest";

import {
  libraryAssetSchema,
  libraryDerivativeSchema,
  libraryCursorSchema,
  libraryEmptyInputSchema,
  libraryOlderInputSchema,
  libraryOlderRoute,
  libraryResponseSchema,
  libraryRoute,
} from "../src/uploads/index.ts";

const id = "018f22f2-9c1a-7b21-8c45-000000000001";
const derivative = {
  contentType: "image/webp",
  expiresAt: "2026-10-06T12:05:00.000Z",
  heightPixels: 3,
  kind: "thumbnail",
  url: "https://storage.example.test/a?sig=1",
  widthPixels: 4,
};
const asset = {
  createdAt: "2026-10-06T12:00:00.000Z",
  derivativeAccess: "available",
  derivatives: [derivative],
  fileName: "piece-1.png",
  heightPixels: 30,
  id,
  processingState: "processed",
  purpose: "collection-artwork",
  rejectionReason: null,
  widthPixels: 40,
};

describe("asset library contracts", () => {
  it("accepts processed, pending, and rejected presentations", () => {
    expect(libraryAssetSchema.safeParse(asset).success).toBe(true);
    expect(
      libraryAssetSchema.safeParse({
        ...asset,
        derivativeAccess: "none",
        derivatives: [],
        heightPixels: null,
        processingState: "pending-validation",
        widthPixels: null,
      }).success,
    ).toBe(true);
    expect(
      libraryAssetSchema.safeParse({
        ...asset,
        derivativeAccess: "none",
        derivatives: [],
        processingState: "rejected",
        rejectionReason: "malformed",
      }).success,
    ).toBe(true);
    expect(
      libraryResponseSchema.safeParse({
        assets: [asset],
        nextCursor: "1760000000000.0198a000-0000-7000-8000-000000000001",
      }).success,
    ).toBe(true);
  });

  it.each([
    ["an unknown field on an asset", { ...asset, storageKey: "x" }],
    ["an unknown access state", { ...asset, derivativeAccess: "maybe" }],
    ["an unknown state", { ...asset, processingState: "done" }],
    ["an unknown reason", { ...asset, rejectionReason: "bad" }],
    ["a non-UUIDv7 id", { ...asset, id: "1" }],
    ["a zero width", { ...asset, widthPixels: 0 }],
    ["a missing purpose", { ...asset, purpose: undefined }],
  ])("rejects %s", (_name, value) => {
    expect(libraryAssetSchema.safeParse(value).success).toBe(false);
  });

  it("limits signed URLs to http(s) renditions of known kinds without extra fields", () => {
    expect(
      libraryDerivativeSchema.safeParse({
        ...derivative,
        url: "http://127.0.0.1:9000/a",
      }).success,
    ).toBe(true);
    for (const bad of [
      { ...derivative, url: "javascript:alert(1)" },
      { ...derivative, url: "ftp://example.test/a" },
      { ...derivative, url: "not a url" },
      { ...derivative, kind: "banner" },
      { ...derivative, contentType: "image/gif" },
      { ...derivative, objectKey: "derivatives/a" },
    ])
      expect(libraryDerivativeSchema.safeParse(bad).success).toBe(false);
  });

  it("takes no input and exposes a stable GET route", () => {
    expect(libraryEmptyInputSchema.safeParse({}).success).toBe(true);
    expect(libraryEmptyInputSchema.safeParse({ limit: 5 }).success).toBe(false);
    expect(libraryRoute).toEqual({
      method: "GET",
      operationId: "listUploadedAssets",
      path: "/api/v1/uploads/assets",
    });
    expect(
      libraryResponseSchema.safeParse({ assets: [], nextCursor: "yes" })
        .success,
    ).toBe(false);
  });

  it("carries the file name an asset was uploaded with, or null, and refuses a path", () => {
    expect(
      libraryAssetSchema.parse({ ...asset, fileName: null }).fileName,
    ).toBeNull();
    expect(
      libraryAssetSchema.safeParse({ ...asset, fileName: "a/b.png" }).success,
    ).toBe(false);
    expect(
      libraryAssetSchema.safeParse({ ...asset, fileName: undefined }).success,
    ).toBe(false);
  });

  it("takes a cursor of a time and an id, and nothing else, to page back", () => {
    const cursor = "1760000000000.0198a000-0000-7000-8000-000000000001";
    expect(libraryCursorSchema.safeParse(cursor).success).toBe(true);
    for (const bad of [
      "",
      "yesterday",
      "1760000000000",
      "176000000000.0198a000-0000-7000-8000-000000000001",
      "1760000000000.not-a-uuid",
      `${cursor}0`,
      `; drop table assets;--`,
    ])
      expect(libraryCursorSchema.safeParse(bad).success).toBe(false);
    expect(libraryOlderInputSchema.safeParse({ before: cursor }).success).toBe(
      true,
    );
    expect(libraryOlderInputSchema.safeParse({}).success).toBe(false);
    expect(
      libraryOlderInputSchema.safeParse({ before: cursor, userId: "x" })
        .success,
    ).toBe(false);
    expect(libraryOlderRoute).toEqual({
      method: "POST",
      operationId: "listOlderUploadedAssets",
      path: "/api/v1/uploads/assets/older",
    });
  });

  it("answers with a cursor for the next page or null for the last", () => {
    const cursor = "1760000000000.0198a000-0000-7000-8000-000000000001";
    expect(
      libraryResponseSchema.safeParse({ assets: [], nextCursor: cursor })
        .success,
    ).toBe(true);
    expect(
      libraryResponseSchema.safeParse({ assets: [], nextCursor: null }).success,
    ).toBe(true);
    expect(libraryResponseSchema.safeParse({ assets: [] }).success).toBe(false);
    expect(
      libraryResponseSchema.safeParse({ assets: [], truncated: true }).success,
    ).toBe(false);
  });
});
