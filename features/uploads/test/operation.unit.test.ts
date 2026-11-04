import { idempotencyKeyConflict, unauthenticated } from "@ador/http/outcome";
import { idempotencyKeySchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { uploadOutcomes } from "@ador/shared/uploads";
import { describe, expect, it, vi } from "vitest";

import { createUploadIntentOperation } from "../src/application/operation.ts";

const userId = uuidV7Schema.parse("018f22f2-9c1a-7b21-8c45-000000000001");
const context = {
  actorSession: null,
  actorUserId: userId,
  correlationId: userId,
  idempotencyKey: idempotencyKeySchema.parse("upload-request-0001"),
};
const input = {
  byteLength: 100,
  contentType: "image/png",
  purpose: "creator-avatar",
} as const;

describe("create upload intent operation", () => {
  it("requires authentication without constructing the service", async () => {
    const getService = vi.fn();
    const operation = createUploadIntentOperation(getService);
    await expect(
      operation.execute(input, { ...context, actorUserId: null }),
    ).resolves.toEqual(unauthenticated);
    expect(getService).not.toHaveBeenCalled();
  });

  it("fails closed if the HTTP adapter omits required idempotency context", async () => {
    const getService = vi.fn();
    const operation = createUploadIntentOperation(getService);
    await expect(
      operation.execute(input, { ...context, idempotencyKey: undefined }),
    ).rejects.toThrow("Idempotency boundary missing");
    expect(getService).not.toHaveBeenCalled();
  });

  it("serializes dates and the temporary URL", async () => {
    const expiresAt = new Date("2026-09-13T12:15:00.000Z");
    const operation = createUploadIntentOperation(async () => ({
      complete: vi.fn(),
      create: vi.fn(async () => ({
        intent: { ...input, expiresAt, id: userId },
        kind: "created" as const,
        upload: {
          expiresAt,
          headers: { "content-length": "100" },
          method: "PUT" as const,
          url: new URL("https://uploads.example.test/private"),
        },
      })),
    }));
    await expect(operation.execute(input, context)).resolves.toMatchObject({
      ok: true,
      value: {
        intent: { expiresAt: expiresAt.toISOString() },
        upload: {
          expiresAt: expiresAt.toISOString(),
          url: "https://uploads.example.test/private",
        },
      },
    });
  });

  it("answers a reused idempotency key as every operation does", async () => {
    const operation = createUploadIntentOperation(async () => ({
      complete: vi.fn(),
      create: vi.fn(async () => ({ kind: "conflict" as const })),
    }));
    await expect(operation.execute(input, context)).resolves.toEqual(
      idempotencyKeyConflict,
    );
  });

  it.each([
    ["quota-exceeded", "upload-limit-reached"],
    ["invalid-size", "file-over-limit"],
  ] as const)(
    "maps %s to the catalogue's %s: its status class, its words and its reason",
    async (kind, outcome) => {
      const operation = createUploadIntentOperation(async () => ({
        complete: vi.fn(),
        create: vi.fn(async () => ({ kind })),
      }));
      await expect(operation.execute(input, context)).resolves.toEqual({
        error: uploadOutcomes[outcome].http,
        message: uploadOutcomes[outcome].message,
        ok: false,
        reason: outcome,
      });
    },
  );
});
