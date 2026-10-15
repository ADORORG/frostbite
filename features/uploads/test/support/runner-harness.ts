import { vi } from "vitest";

import type { UploadsApi } from "../../src/client/api-client.ts";
import { resolveUploadClientPolicy } from "../../src/client/client-policy.ts";
import type { ObjectTransfer } from "../../src/client/transfer.ts";
import {
  createUploadAttempt,
  createUploadRunner,
} from "../../src/client/upload-runner.ts";
import type { UploadEvent } from "../../src/client/upload-state.ts";
import { assetId, intentId, processedAsset } from "./library-fixtures.ts";

export const checked = { byteLength: 3, contentType: "image/png" } as const;
export const attempt = createUploadAttempt({
  file: { name: "a.png", size: 3 },
  idempotencyKey: "upload-attempt-0001",
  purpose: "collection-artwork",
});
export const policy = resolveUploadClientPolicy({
  pollIntervalMs: 1,
  pollMaxAttempts: 3,
});
export const intent = {
  intent: {
    byteLength: 3,
    contentType: checked.contentType,
    expiresAt: "2026-10-06T12:15:00.000Z",
    id: intentId,
    purpose: attempt.purpose,
  },
  upload: {
    expiresAt: "2026-10-06T12:15:00.000Z",
    headers: { "content-length": "3", "content-type": "image/png" },
    method: "PUT" as const,
    url: "https://storage.example.test/up?sig=1",
  },
};

export function setup(
  overrides: { api?: Partial<UploadsApi>; transfer?: ObjectTransfer } = {},
) {
  const api: UploadsApi = {
    completeIntent: vi.fn(async () => ({
      asset: { id: assetId, processingState: "pending-validation" as const },
    })),
    createIntent: vi.fn(async () => intent),
    listAssets: vi.fn(async () => ({
      assets: [processedAsset()],
      nextCursor: null,
    })),
    listOlderAssets: vi.fn(async () => ({ assets: [], nextCursor: null })),
    ...overrides.api,
  };
  const transfer: ObjectTransfer = overrides.transfer ?? {
    upload: vi.fn(async ({ onProgress }) => onProgress(0.5)),
  };
  const events: UploadEvent[] = [];
  const controller = new AbortController();
  const run = createUploadRunner({
    api,
    policy,
    sleep: async () => undefined,
    transfer,
  });
  return {
    api,
    controller,
    events,
    go: (from = attempt) =>
      run({
        attempt: from,
        checked,
        emit: (event) => events.push(event),
        file: new Blob(["abc"]),
        signal: controller.signal,
      }),
    transfer,
  };
}
