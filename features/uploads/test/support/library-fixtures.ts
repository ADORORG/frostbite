import type { LibraryAsset } from "@frostbite/shared/uploads";

export const assetId = "018f22f2-9c1a-7b21-8c45-000000000001";
export const intentId = "018f22f2-9c1a-7b21-8c45-000000000002";

export function libraryAsset(
  overrides: Partial<LibraryAsset> = {},
): LibraryAsset {
  return {
    createdAt: "2026-10-06T12:00:00.000Z",
    derivativeAccess: "none",
    derivatives: [],
    fileName: null,
    heightPixels: null,
    id: assetId,
    processingState: "pending-validation",
    purpose: "collection-artwork",
    rejectionReason: null,
    widthPixels: null,
    ...overrides,
  };
}

export function processedAsset(
  overrides: Partial<LibraryAsset> = {},
): LibraryAsset {
  return libraryAsset({
    derivativeAccess: "available",
    derivatives: [
      {
        contentType: "image/webp",
        expiresAt: "2026-10-06T12:05:00.000Z",
        heightPixels: 3,
        kind: "thumbnail",
        url: "https://storage.example.test/t.webp?sig=1",
        widthPixels: 4,
      },
      {
        contentType: "image/webp",
        expiresAt: "2026-10-06T12:05:00.000Z",
        heightPixels: 30,
        kind: "preview",
        url: "https://storage.example.test/p.webp?sig=1",
        widthPixels: 40,
      },
    ],
    heightPixels: 30,
    processingState: "processed",
    widthPixels: 40,
    ...overrides,
  });
}
