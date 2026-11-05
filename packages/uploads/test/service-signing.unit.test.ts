import { describe, expect, it, vi } from "vitest";
import { providerIdSchema } from "@frostbite/shared/providers";

import { createUploadIntentService } from "../src/application/service.ts";
import {
  dependencies,
  idempotencyKey,
  input,
  intentId,
  now,
  userId,
} from "./support/intent-service-fixtures.ts";

describe("upload intent signing lifetime", () => {
  it.each([
    [1_999, "conflict"],
    [2_000, "created"],
  ] as const)(
    "signs a replay with %s ms left only if one second of lifetime remains after the margin",
    async (remainingMs, kind) => {
      const values = dependencies();
      vi.mocked(values.repository.reserve).mockImplementationOnce(
        async (request) => ({
          intent: {
            ...request,
            expiresAt: new Date(now.getTime() + remainingMs),
          },
          kind: "replayed",
        }),
      );
      vi.mocked(values.storage.presignPrivateUpload).mockResolvedValueOnce({
        expiresAt: new Date(now.getTime() + 1_000),
        headers: {},
        method: "PUT",
        url: new URL("https://uploads.example.test/private"),
      });
      const service = createUploadIntentService({
        clock: () => now,
        createDraftKey: () => "unused",
        createId: () => intentId,
        repository: values.repository,
        storage: values.storage,
      });
      await expect(
        service.create(input, { idempotencyKey, userId }),
      ).resolves.toMatchObject({ kind });
      if (kind === "created")
        expect(values.storage.presignPrivateUpload).toHaveBeenCalledWith(
          expect.objectContaining({ expiresInSeconds: 1 }),
        );
    },
  );

  // Regression: a provider stamps credentials from its own clock, a few milliseconds after the
  // service read its clock. Signing for the full lifetime made every fresh intent fail with
  // "Upload credential exceeds its persisted authorization expiry".
  it("signs a fresh intent when the provider's clock runs a little ahead of the service's", async () => {
    const values = dependencies();
    const providerDelayMs = 40;
    vi.mocked(values.storage.presignPrivateUpload).mockImplementationOnce(
      async ({ expiresInSeconds }) => ({
        expiresAt: new Date(
          now.getTime() + providerDelayMs + expiresInSeconds * 1_000,
        ),
        headers: {},
        method: "PUT",
        url: new URL("https://uploads.example.test/private"),
      }),
    );
    const service = createUploadIntentService({
      clock: () => now,
      createDraftKey: () => "opaque-key",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    const result = await service.create(input, { idempotencyKey, userId });
    expect(result.kind).toBe("created");
    expect(values.storage.presignPrivateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 899 }),
    );
  });

  it("measures the remaining lifetime from the moment of signing, not from reservation", async () => {
    const values = dependencies();
    let readings = 0;
    const service = createUploadIntentService({
      // Each reading is 500 ms later than the last, as real time passes between steps.
      clock: () => new Date(now.getTime() + 500 * readings++),
      createDraftKey: () => "opaque-key",
      createId: () => intentId,
      repository: values.repository,
      storage: values.storage,
    });
    await service.create(input, { idempotencyKey, userId });
    // Reserved at +0 (expires +900 s); signed at +500 ms: 899.5 s left, minus the 1 s margin.
    expect(values.storage.presignPrivateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: 898 }),
    );
  });

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
});
