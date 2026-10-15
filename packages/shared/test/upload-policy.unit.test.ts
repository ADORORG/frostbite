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
      derivativeReadLifetimeMs: 300_000,
      libraryPageSize: 48,
      cleanupBatchSize: 50,
      cleanupConcurrency: 5,
      cleanupDeleteTimeoutMs: 30_000,
      cleanupRetryBaseMs: 300_000,
      cleanupRetryMaxMs: 21_600_000,
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

  it("keeps signed derivative reads short-lived and the library page bounded", () => {
    expect(
      resolveUploadPolicy({
        derivativeReadLifetimeMs: defaultUploadPolicy.presignedUrlLifetimeMs,
      }).derivativeReadLifetimeMs,
    ).toBe(900_000);
    for (const derivativeReadLifetimeMs of [59_999, 900_001, 3_600_001, 1.5, 0])
      expect(() => resolveUploadPolicy({ derivativeReadLifetimeMs })).toThrow();
    expect(resolveUploadPolicy({ libraryPageSize: 1 }).libraryPageSize).toBe(1);
    expect(resolveUploadPolicy({ libraryPageSize: 100 }).libraryPageSize).toBe(
      100,
    );
    for (const libraryPageSize of [0, 101, 1.5, -1])
      expect(() => resolveUploadPolicy({ libraryPageSize })).toThrow();
  });

  it("bounds the cleanup batch", () => {
    expect(resolveUploadPolicy({ cleanupBatchSize: 1 }).cleanupBatchSize).toBe(
      1,
    );
    expect(
      resolveUploadPolicy({ cleanupBatchSize: 500 }).cleanupBatchSize,
    ).toBe(500);
    for (const cleanupBatchSize of [0, 501, 1.5, -1])
      expect(() => resolveUploadPolicy({ cleanupBatchSize })).toThrow();
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

  it("bounds how cleanup runs and backs off, and never lets the longest wait be shorter than the first", () => {
    expect(
      resolveUploadPolicy({ cleanupConcurrency: 20 }).cleanupConcurrency,
    ).toBe(20);
    for (const bad of [
      { cleanupConcurrency: 0 },
      { cleanupConcurrency: 21 },
      { cleanupDeleteTimeoutMs: 999 },
      { cleanupDeleteTimeoutMs: 300_001 },
      { cleanupRetryBaseMs: 59_999 },
      { cleanupRetryMaxMs: 59_999 },
      { cleanupRetryBaseMs: 600_000, cleanupRetryMaxMs: 300_000 },
    ])
      expect(() => resolveUploadPolicy(bad)).toThrow();
    expect(
      resolveUploadPolicy({
        cleanupRetryBaseMs: 600_000,
        cleanupRetryMaxMs: 600_000,
      }).cleanupRetryMaxMs,
    ).toBe(600_000);
  });
});
