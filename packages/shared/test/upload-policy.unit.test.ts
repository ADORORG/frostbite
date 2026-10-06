import { describe, expect, it } from "vitest";

import {
  defaultUploadPolicy,
  resolveUploadPolicy,
  uploadPurposeSchema,
} from "../src/uploads/index.ts";

describe("upload policy", () => {
  it("owns the approved configurable beta defaults", () => {
    expect(defaultUploadPolicy).toMatchObject({
      activeIntentLimitPerUser: 2,
      cleanupDelayMs: 86_400_000,
      intentRetentionMs: 2_592_000_000,
      maxImageDimension: 8_192,
      maxImagePixels: 40_000_000,
      maxBytesByPurpose: {
        "collection-artwork": 25_000_000,
        "collection-banner": 15_000_000,
        "collection-item-artwork": 25_000_000,
        "creator-avatar": 5_000_000,
      },
      presignedUrlLifetimeMs: 900_000,
    });
    expect(resolveUploadPolicy({ activeIntentLimitPerUser: 1 })).toMatchObject({
      activeIntentLimitPerUser: 1,
    });
    expect(
      resolveUploadPolicy({
        maxBytesByPurpose: { "creator-avatar": 1_000_000 },
      }).maxBytesByPurpose,
    ).toEqual({
      ...defaultUploadPolicy.maxBytesByPurpose,
      "creator-avatar": 1_000_000,
    });
  });

  it("fails closed for unknown purposes and unsafe policy overrides", () => {
    expect(uploadPurposeSchema.safeParse("game-bundle").success).toBe(false);
    expect(() =>
      resolveUploadPolicy({
        cleanupDelayMs: defaultUploadPolicy.presignedUrlLifetimeMs,
      }),
    ).toThrow("Cleanup delay");
  });

  it("bounds image limits to what the database can persist", () => {
    expect(
      resolveUploadPolicy({ maxImageDimension: 2 ** 31 - 1 }).maxImageDimension,
    ).toBe(2 ** 31 - 1);
    for (const maxImageDimension of [0, -1, 1.5, 2 ** 31])
      expect(() => resolveUploadPolicy({ maxImageDimension })).toThrow();
    for (const maxImagePixels of [0, -1, 1.5])
      expect(() => resolveUploadPolicy({ maxImagePixels })).toThrow();
  });
});
