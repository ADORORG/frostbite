import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi, type Mock } from "vitest";

import type { UploadsApi } from "../../src/client/api-client.ts";
import type { UploadsClientServices } from "../../src/client/browser-services.ts";
import { resolveUploadClientPolicy } from "../../src/client/client-policy.ts";
import type { ObjectTransfer } from "../../src/client/transfer.ts";
import { assetId, intentId } from "./library-fixtures.ts";

const mounted: { container: HTMLElement; root: Root }[] = [];

export async function mount(element: ReactElement) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  await act(() => root.render(element));
  return container;
}

export async function unmountAll() {
  for (const { container, root } of mounted.splice(0)) {
    await act(() => root.unmount());
    container.remove();
  }
}

export const click = (element: Element | null) => {
  if (element === null) throw new Error("element to click is missing");
  return act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

// Waits for an assertion to hold while the app updates on its own (timers, promises). `act` is
// switched off for the wait, as React's own testing library does, because updates made outside an
// `act` scope are applied immediately instead of being queued until the scope ends.
export async function settle(assertion: () => void, timeout = 3_000) {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
  try {
    await vi.waitFor(assertion, { interval: 10, timeout });
  } finally {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  }
  await act(async () => undefined);
}

export const textOf = (container: HTMLElement) => container.textContent ?? "";

export function button(
  container: HTMLElement,
  label: string,
): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    ) ?? null
  );
}

export async function chooseFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement))
    throw new Error("file input is missing");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(() => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export async function chooseOption(container: HTMLElement, value: string) {
  const select = container.querySelector("select");
  if (select === null) throw new Error("select is missing");
  await act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export const imageFile = (size = 3, type = "image/png") =>
  new File([new Uint8Array(size)], "art.png", { type });

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
        (async () => ({ assets: [], truncated: false })),
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
