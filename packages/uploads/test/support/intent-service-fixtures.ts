import { Readable } from "node:stream";

import type {
  ObjectStoragePort,
  PresignedUpload,
} from "@ador/object-storage/contracts";
import { idempotencyKeySchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { providerIdSchema } from "@ador/shared/providers";
import { vi } from "vitest";

import type {
  ReserveUploadIntentResult,
  UploadIntentRepository,
} from "../../src/application/repository.ts";

export const userId = uuidV7Schema.parse(
  "018f22f2-9c1a-7b21-8c45-000000000001",
);
export const intentId = uuidV7Schema.parse(
  "018f22f2-9c1a-7b21-8c45-000000000002",
);
export const idempotencyKey = idempotencyKeySchema.parse("upload-request-0001");
export const now = new Date("2026-09-13T12:00:00.000Z");
export const input = {
  byteLength: 100,
  contentType: "image/png",
  purpose: "creator-avatar",
} as const;

export function dependencies() {
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
