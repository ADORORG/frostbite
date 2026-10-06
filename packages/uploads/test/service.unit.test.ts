import { Readable } from "node:stream";

import type {
  ObjectStoragePort,
  PresignedUpload,
} from "@ador/object-storage/contracts";
import { idempotencyKeySchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { describe, expect, it, vi } from "vitest";

import type { UploadIntentRepository } from "../src/application/repository.ts";
import type { ReserveUploadIntentResult } from "../src/application/repository.ts";
import { createUploadIntentService } from "../src/application/service.ts";

const userId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000001");
const intentId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000002");
const idempotencyKey = idempotencyKeySchema.parse("upload-request-0001");
const now = new Date("2026-09-13T12:00:00.000Z");
const input = {
  byteLength: 100,
  contentType: "image/png",
  purpose: "creator-avatar",
} as const;

function dependencies() {
  const events: string[] = [];
  const repository: UploadIntentRepository = {
    complete: vi.fn(),
    findForCompletion: vi.fn(),
    markSigningFailed: vi.fn(async () => undefined),
    reserve: vi.fn(async (input): Promise<ReserveUploadIntentResult> => {
      events.push("reserved");
      return { intent: input, kind: "reserved" };
    }),
  };
  const storage: ObjectStoragePort = {
    copyPrivateToPublicIfAbsent: vi.fn(),
    delete: vi.fn(),
    presignPrivateRead: vi.fn(),
    head: vi.fn(),
    providerId: providerIdSchema.parse("test-object-storage"),
    presignPrivateUpload: vi.fn(async (): Promise<PresignedUpload> => {
      events.push("signed");
      return {
        expiresAt: new Date(now.getTime() + 900_000),
        headers: { "content-length": "100" },
        method: "PUT",
        url: new URL("https://uploads.example.test/private"),
      };
    }),
    read: vi.fn(async () => ({
      body: Readable.from([]),
      contentLength: 0,
      contentType: "image/png",
      entityTag: "unused",
      lastModified: now,
    })),
    write: vi.fn(),
  };
  return { events, repository, storage };
}

describe("upload intent service", () => {
  it("persists before signing and returns the approved upload contract", async () => {
    const values = dependencies();
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "opaque-key",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    const result = await service.create(
      { byteLength: 100, contentType: "image/png", purpose: "creator-avatar" },
      { idempotencyKey, userId },
    );
    expect(values.events).toEqual(["reserved", "signed"]);
    expect(result).toMatchObject({
      intent: { expiresAt: new Date(now.getTime() + 900_000), id: intentId },
      kind: "created",
      upload: { method: "PUT" },
    });
  });

  it("rejects oversized input before persistence", async () => {
    const values = dependencies();
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "opaque-key",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    await expect(
      service.create(
        {
          byteLength: 5_000_001,
          contentType: "image/png",
          purpose: "creator-avatar",
        },
        { idempotencyKey, userId },
      ),
    ).resolves.toEqual({ kind: "invalid-size" });
    expect(values.repository.reserve).not.toHaveBeenCalled();
  });

  it("never signs a replay beyond its persisted authorization expiry", async () => {
    const values = dependencies();
    const replayExpiry = new Date(now.getTime() + 300_000);
    vi.mocked(values.repository.reserve).mockImplementationOnce(
      async (request) => ({
        intent: { ...request, expiresAt: replayExpiry },
        kind: "replayed",
      }),
    );
    vi.mocked(values.storage.presignPrivateUpload).mockResolvedValueOnce({
      expiresAt: replayExpiry,
      headers: { "content-length": "100" },
      method: "PUT",
      url: new URL("https://uploads.example.test/private"),
    });
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "unused-on-replay",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    await service.create(input, { idempotencyKey, userId });
    expect(values.storage.presignPrivateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 300 }),
    );
  });

  it.each(["conflict", "quota-exceeded"] as const)(
    "does not sign when persistence returns %s",
    async (kind) => {
      const values = dependencies();
      vi.mocked(values.repository.reserve).mockResolvedValueOnce({ kind });
      const service = createUploadIntentService({
        clock: () => now,
        createDraftKey: () => "unused",
        createId: () => intentId,
        repository: values.repository,
        storage: values.storage,
      });
      await expect(
        service.create(input, { idempotencyKey, userId }),
      ).resolves.toEqual({ kind });
      expect(values.storage.presignPrivateUpload).not.toHaveBeenCalled();
    },
  );

  it("does not sign a replay with less than one second remaining", async () => {
    const values = dependencies();
    vi.mocked(values.repository.reserve).mockImplementationOnce(
      async (request) => ({
        intent: {
          ...request,
          expiresAt: new Date(now.getTime() + 999),
        },
        kind: "replayed",
      }),
    );
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "unused",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    await expect(
      service.create(input, { idempotencyKey, userId }),
    ).resolves.toEqual({ kind: "conflict" });
    expect(values.storage.presignPrivateUpload).not.toHaveBeenCalled();
  });

  it("does not sign a replay through a different storage provider", async () => {
    const values = dependencies();
    vi.mocked(values.repository.reserve).mockImplementationOnce(
      async (request) => ({
        intent: {
          ...request,
          storageProviderId: providerIdSchema.parse("previous-storage"),
        },
        kind: "replayed",
      }),
    );
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "unused",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    await expect(
      service.create(input, { idempotencyKey, userId }),
    ).resolves.toEqual({ kind: "conflict" });
    expect(values.storage.presignPrivateUpload).not.toHaveBeenCalled();
  });

  it("releases the reservation when signing fails", async () => {
    const values = dependencies();
    vi.mocked(values.storage.presignPrivateUpload).mockRejectedValueOnce(
      new Error("provider unavailable"),
    );
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "opaque-key",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    await expect(
      service.create(
        {
          byteLength: 100,
          contentType: "image/png",
          purpose: "creator-avatar",
        },
        { idempotencyKey, userId },
      ),
    ).rejects.toThrow("provider unavailable");
    expect(values.repository.markSigningFailed).toHaveBeenCalledWith({
      failedAt: now,
      intentId,
      userId,
    });
  });

  it.each([
    ["outlives", new Date(now.getTime() + 900_001)],
    ["has an invalid expiry for", new Date(Number.NaN)],
  ])(
    "rejects a provider credential that %s its authorization",
    async (_, expiry) => {
      const values = dependencies();
      vi.mocked(values.storage.presignPrivateUpload).mockResolvedValueOnce({
        expiresAt: expiry,
        headers: { "content-length": "100" },
        method: "PUT",
        url: new URL("https://uploads.example.test/private"),
      });
      const service = createUploadIntentService({
        clock: () => now,
        createDraftKey: () => "opaque-key",
        createId: () => intentId,
        repository: values.repository,
        storage: values.storage,
      });

      await expect(
        service.create(input, { idempotencyKey, userId }),
      ).rejects.toThrow("authorization expiry");
      expect(values.repository.markSigningFailed).toHaveBeenCalledWith({
        failedAt: now,
        intentId,
        userId,
      });
    },
  );
});
