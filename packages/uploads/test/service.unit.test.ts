import { describe, expect, it, vi } from "vitest";

import { createUploadIntentService } from "../src/application/service.ts";
import {
  dependencies,
  idempotencyKey,
  input,
  intentId,
  now,
  userId,
} from "./support/intent-service-fixtures.ts";

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
      expect.objectContaining({ expiresInSeconds: 299 }),
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
