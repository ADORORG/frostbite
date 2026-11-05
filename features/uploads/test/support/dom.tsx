import { act } from "react";
import { vi, type Mock } from "vitest";

import type { UploadsApi } from "../../src/client/api-client.ts";
import type { UploadsClientServices } from "../../src/client/browser-services.ts";
import { resolveUploadClientPolicy } from "../../src/client/client-policy.ts";
import type { ObjectTransfer } from "../../src/client/transfer.ts";
import { assetId, intentId } from "./library-fixtures.ts";

export {
  button,
  chooseOption,
  click,
  mount,
  settle,
  textOf,
  unmountAll,
} from "@frostbite/test-kit/dom";

export async function chooseFiles(
  container: HTMLElement,
  files: readonly File[],
) {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement))
    throw new Error("file input is missing");
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export const chooseFile = (container: HTMLElement, file: File) =>
  chooseFiles(container, [file]);

export const imageFile = (size = 3, type = "image/png", name = "art.png") =>
  new File([new Uint8Array(size)], name, { type });

const intentResponse = {
  intent: {
    byteLength: 3,
    contentType: "image/png" as const,
    expiresAt: "2026-10-06T12:15:00.000Z",
    id: intentId,
    purpose: "collection-artwork" as const,
  },
  upload: {
    expiresAt: "2026-10-06T12:15:00.000Z",
    headers: { "content-type": "image/png" },
    method: "PUT" as const,
    url: "https://storage.example.test/up?sig=1",
  },
};

export interface FakeApi {
  completeIntent: Mock<UploadsApi["completeIntent"]>;
  createIntent: Mock<UploadsApi["createIntent"]>;
  listAssets: Mock<UploadsApi["listAssets"]>;
  listOlderAssets: Mock<UploadsApi["listOlderAssets"]>;
}

// Services whose every call is a spy with a sensible default; each test overrides what it cares about.
// The default library is empty on purpose: an asset that never finishes would make the library poll
// every millisecond (the test policy), a hot loop that starves `act` when the machine is busy.
export function fakeServices(
  overrides: { api?: Partial<UploadsApi>; transfer?: ObjectTransfer } = {},
): UploadsClientServices & { api: FakeApi } {
  let keys = 0;
  const api: FakeApi = {
    completeIntent: vi.fn<UploadsApi["completeIntent"]>(
      overrides.api?.completeIntent ??
        (async () => ({
          asset: { id: assetId, processingState: "pending-validation" },
        })),
    ),
    createIntent: vi.fn<UploadsApi["createIntent"]>(
      overrides.api?.createIntent ?? (async () => intentResponse),
    ),
    listAssets: vi.fn<UploadsApi["listAssets"]>(
      overrides.api?.listAssets ??
        (async () => ({ assets: [], nextCursor: null })),
    ),
    listOlderAssets: vi.fn<UploadsApi["listOlderAssets"]>(
      overrides.api?.listOlderAssets ??
        (async () => ({ assets: [], nextCursor: null })),
    ),
  };
  return {
    api,
    createIdempotencyKey: () =>
      `upload-attempt-${String((keys += 1)).padStart(4, "0")}`,
    now: () => Date.parse("2026-10-06T12:00:00.000Z"),
    policy: resolveUploadClientPolicy({
      minimumRefreshDelayMs: 1,
      pollIntervalMs: 1,
      pollMaxAttempts: 3,
      signedUrlRefreshMarginMs: 1,
    }),
    sleep: async () => undefined,
    transfer: overrides.transfer ?? {
      upload: async ({ onProgress }) => onProgress(1),
    },
  };
}

export { assetId, intentId };
