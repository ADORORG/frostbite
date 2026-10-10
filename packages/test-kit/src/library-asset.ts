import type { LibraryAsset } from "@ador/shared/uploads";

const defaultCreatedAt = "2026-10-09T12:00:00.000Z";

// A processed library asset with a thumbnail, as the uploads library presents it to a browser: the
// shape every UI suite that shows creator images needs.
export function libraryAssetFixture(
  purpose: LibraryAsset["purpose"],
  assetId: string,
  overrides: Partial<LibraryAsset> = {},
): LibraryAsset {
  return {
    createdAt: defaultCreatedAt,
    derivativeAccess: "available",
    derivatives: [
      {
        contentType: "image/webp",
        expiresAt: "2099-01-01T00:00:00.000Z",
        heightPixels: 8,
        kind: "thumbnail",
        url: `https://storage.example.test/${assetId}.webp`,
        widthPixels: 12,
      },
    ],
    heightPixels: 16,
    id: assetId,
    processingState: "processed",
    purpose,
    rejectionReason: null,
    widthPixels: 24,
    ...overrides,
  };
}
