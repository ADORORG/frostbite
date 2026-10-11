import { describe, expect, it } from "vitest";

import {
  assetProcessingStates,
  assetProcessingRequestedEvent,
  assetProcessingRequestedPayloadSchema,
  completeUploadIntentInputSchema,
  completedUploadResponseSchema,
  createUploadIntentInputSchema,
  uploadFileNameMaxLength,
  uploadFileNameSchema,
  uploadIntentRoutes,
} from "../src/uploads/index.ts";

const intentId = "018f22f2-9c1a-7b21-8c45-000000000002";

describe("upload completion contracts", () => {
  it("accepts UUIDv7 intent identifiers and rejects other UUID versions", () => {
    expect(completeUploadIntentInputSchema.parse({ intentId })).toEqual({
      intentId,
    });
    expect(() =>
      completeUploadIntentInputSchema.parse({
        intentId: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toThrow("Expected UUIDv7");
  });

  it("publishes an identifier-only processing contract and detachable route", () => {
    expect(assetProcessingRequestedEvent).toEqual({
      name: "uploads.assetprocessing.requested.v1",
      schemaVersion: 1,
    });
    expect(uploadIntentRoutes.complete).toEqual({
      method: "POST",
      operationId: "completeUploadIntent",
      path: "/api/v1/uploads/intents/complete",
    });
    expect(
      assetProcessingRequestedPayloadSchema.parse({
        assetId: intentId,
        uploadIntentId: intentId,
      }),
    ).toEqual({ assetId: intentId, uploadIntentId: intentId });
    expect(() =>
      assetProcessingRequestedPayloadSchema.parse({
        assetId: intentId,
        projectId: intentId,
        uploadIntentId: intentId,
      }),
    ).toThrow();
  });

  it("exposes only validation states, never publication states", () => {
    expect(assetProcessingStates).toEqual([
      "pending-validation",
      "validated",
      "rejected",
      "processed",
      "unprocessable",
    ]);
    for (const processingState of assetProcessingStates)
      expect(
        completedUploadResponseSchema.parse({
          asset: { id: intentId, processingState },
        }),
      ).toEqual({ asset: { id: intentId, processingState } });
    expect(() =>
      completedUploadResponseSchema.parse({
        asset: { id: intentId, processingState: "published" },
      }),
    ).toThrow();
  });
});

describe("upload file names", () => {
  it.each([
    "art.png",
    "  spaced name (1).webp  ",
    "ünï-💎.jpeg",
    "a".repeat(255),
  ])("accepts the bare name %j", (name) => {
    expect(uploadFileNameSchema.parse(name)).toBe(name.trim());
  });

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["a forward slash", "folder/a.png"],
    ["a backslash", "folder\\a.png"],
    ["a newline", "a\n.png"],
    ["a NUL", "a\u0000.png"],
    ["a delete character", "a\u007f.png"],
    ["too long", "a".repeat(uploadFileNameMaxLength + 1)],
  ])("refuses a name that is %s", (_why, name) => {
    expect(uploadFileNameSchema.safeParse(name).success).toBe(false);
  });

  it("is optional on a new upload, so an upload without a name is still valid", () => {
    const base = {
      byteLength: 3,
      contentType: "image/png",
      purpose: "collection-item-artwork",
    };
    expect(createUploadIntentInputSchema.safeParse(base).success).toBe(true);
    expect(
      createUploadIntentInputSchema.parse({ ...base, fileName: " a.png " })
        .fileName,
    ).toBe("a.png");
    expect(
      createUploadIntentInputSchema.safeParse({ ...base, fileName: "../a.png" })
        .success,
    ).toBe(false);
  });
});
