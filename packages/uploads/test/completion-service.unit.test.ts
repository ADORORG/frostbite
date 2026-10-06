import { Readable } from "node:stream";

import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import { parseObjectKey } from "@ador/object-storage/contracts";
import { correlationIdSchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UploadIntentRepository } from "../src/application/repository.ts";
import { createUploadIntentService } from "../src/application/service.ts";

const userId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000001");
const intentId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000002");
const assetId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000003");
const eventId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000004");
const correlationId = correlationIdSchema.parse(
  "018f22f2-9c1a-7b21-8c45-000000000005",
);
const now = new Date("2026-09-13T12:00:00.000Z");

function setup() {
  const repository: UploadIntentRepository = {
    complete: vi.fn(async ({ assetId: id }) => ({
      asset: { id, processingState: "pending-validation" as const },
      kind: "completed" as const,
    })),
    findForCompletion: vi.fn(async () => ({
      intent: {
        byteLength: 100,
        contentType: "image/png" as const,
        expiresAt: new Date(now.getTime() + 60_000),
        id: intentId,
        objectKey: parseObjectKey("drafts/object"),
        purpose: "creator-avatar" as const,
        storageProviderId: providerIdSchema.parse("test-object-storage"),
      },
      kind: "ready" as const,
    })),
    markSigningFailed: vi.fn(),
    reserve: vi.fn(),
  };
  const storage: ObjectStoragePort = {
    copyPrivateToPublicIfAbsent: vi.fn(),
    delete: vi.fn(),
    presignPrivateRead: vi.fn(),
    head: vi.fn(async () => ({
      contentLength: 100,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
    })),
    presignPrivateUpload: vi.fn(),
    providerId: providerIdSchema.parse("test-object-storage"),
    read: vi.fn(async () => ({
      body: Readable.from([]),
      contentLength: 100,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
    })),
    write: vi.fn(),
  };
  const ids = [assetId, eventId];
  const service = createUploadIntentService({
    clock: () => now,
    createDraftKey: () => "unused",
    createId: () => ids.shift() ?? eventId,
    repository,
    storage,
  });
  return { repository, service, storage };
}

describe("upload completion service", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("verifies the private object and requests processing atomically", async () => {
    const { repository, service, storage } = setup();
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).resolves.toEqual({
      asset: { id: assetId, processingState: "pending-validation" },
      kind: "completed",
    });
    expect(storage.head).toHaveBeenCalledWith({
      key: parseObjectKey("drafts/object"),
      scope: "private",
    });
    expect(repository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId,
        event: expect.objectContaining({
          correlationId,
          eventId,
          name: "uploads.assetprocessing.requested.v1",
          payload: { assetId, uploadIntentId: intentId },
          schemaVersion: 1,
        }),
        object: expect.objectContaining({
          contentLength: 100,
          providerId: "test-object-storage",
        }),
      }),
    );
  });

  it("replays a completed asset without consulting storage", async () => {
    const { repository, service, storage } = setup();
    vi.mocked(repository.findForCompletion).mockResolvedValueOnce({
      asset: { id: assetId, processingState: "pending-validation" },
      kind: "completed",
    });
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).resolves.toEqual({
      asset: { id: assetId, processingState: "pending-validation" },
      kind: "replayed",
    });
    expect(storage.head).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("does not inspect storage for an unavailable intent", async () => {
    const { repository, service, storage } = setup();
    vi.mocked(repository.findForCompletion).mockResolvedValueOnce({
      kind: "unavailable",
    });
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).resolves.toEqual({ kind: "unavailable" });
    expect(storage.head).not.toHaveBeenCalled();
  });

  it("does not inspect a key through a different storage provider", async () => {
    const { repository, service, storage } = setup();
    vi.mocked(repository.findForCompletion).mockResolvedValueOnce({
      intent: {
        byteLength: 100,
        contentType: "image/png",
        expiresAt: new Date(now.getTime() + 60_000),
        id: intentId,
        objectKey: parseObjectKey("drafts/object"),
        purpose: "creator-avatar",
        storageProviderId: providerIdSchema.parse("previous-storage"),
      },
      kind: "ready",
    });
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).resolves.toEqual({ kind: "unavailable" });
    expect(storage.head).not.toHaveBeenCalled();
  });

  it("does not persist when the private object is missing", async () => {
    const { repository, service, storage } = setup();
    vi.mocked(storage.head).mockResolvedValueOnce(null);
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).resolves.toEqual({ kind: "missing-object" });
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong size", { contentLength: 99 }],
    ["unsafe size", { contentLength: Number.MAX_SAFE_INTEGER + 1 }],
    ["blank content type", { contentType: " " }],
    ["blank entity tag", { entityTag: " " }],
    ["invalid modification time", { lastModified: new Date(Number.NaN) }],
  ])("rejects provider metadata with %s", async (_, replacement) => {
    const { repository, service, storage } = setup();
    vi.mocked(storage.head).mockResolvedValueOnce({
      contentLength: 100,
      contentType: "image/png",
      entityTag: "etag",
      lastModified: now,
      ...replacement,
    });
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).resolves.toEqual({ kind: "invalid-object" });
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("propagates provider failure without changing authoritative state", async () => {
    const { repository, service, storage } = setup();
    vi.mocked(storage.head).mockRejectedValueOnce(new Error("provider down"));
    await expect(
      service.complete({ intentId }, { correlationId, userId }),
    ).rejects.toThrow("provider down");
    expect(repository.complete).not.toHaveBeenCalled();
  });
});
