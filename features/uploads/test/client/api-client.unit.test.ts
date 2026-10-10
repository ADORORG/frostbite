import { describe, expect, it, vi } from "vitest";

import {
  createUploadsApi,
  type FetchLike,
} from "../../src/client/api-client.ts";
import {
  ApiError,
  isRetryableApiError,
  type ApiErrorCode,
} from "@ador/client-http";
import { assetId, intentId } from "../support/library-fixtures.ts";

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
const correlationId = "018f22f2-9c1a-7b21-8c45-0000000000aa";
const envelope = (code: string, status: number) =>
  json({ error: { code, correlationId, message: "Nope." } }, status);
const intent = {
  intent: {
    byteLength: 5,
    contentType: "image/png",
    expiresAt: "2026-10-06T12:15:00.000Z",
    id: intentId,
    purpose: "collection-artwork",
  },
  upload: {
    expiresAt: "2026-10-06T12:15:00.000Z",
    headers: { "content-type": "image/png" },
    method: "PUT",
    url: "https://storage.example.test/up?sig=1",
  },
};
const key = "upload-attempt-0001";
const input = {
  byteLength: 5,
  contentType: "image/png",
  purpose: "collection-artwork",
} as const;

function apiWith(respond: FetchLike) {
  const fetchImpl = vi.fn(respond);
  return { api: createUploadsApi(fetchImpl), fetchImpl };
}

describe("uploads API client", () => {
  it("creates an intent with the idempotency key and a JSON body", async () => {
    const { api, fetchImpl } = apiWith(async () => json(intent));
    await expect(
      api.createIntent(input, { idempotencyKey: key }),
    ).resolves.toEqual(intent);
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/uploads/intents", {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json", "idempotency-key": key },
      method: "POST",
    });
  });

  it("completes an intent and lists assets, sending a body only when there is one", async () => {
    const { api, fetchImpl } = apiWith(async (path) =>
      path.endsWith("/complete")
        ? json({
            asset: { id: assetId, processingState: "pending-validation" },
          })
        : json({ assets: [], truncated: false }),
    );
    await expect(api.completeIntent({ intentId })).resolves.toEqual({
      asset: { id: assetId, processingState: "pending-validation" },
    });
    await expect(api.listAssets()).resolves.toEqual({
      assets: [],
      truncated: false,
    });
    expect(fetchImpl).toHaveBeenLastCalledWith("/api/v1/uploads/assets", {
      headers: {},
      method: "GET",
    });
  });

  it("passes the abort signal through", async () => {
    const { api, fetchImpl } = apiWith(async () =>
      json({ assets: [], truncated: false }),
    );
    const { signal } = new AbortController();
    await api.listAssets({ signal });
    expect(fetchImpl.mock.calls[0]?.[1].signal).toBe(signal);
  });

  it.each([
    ["conflict", 409],
    ["unauthorized", 401],
    ["invalid_request", 400],
    ["internal_error", 500],
  ])("maps a %s error envelope to a typed error", async (code, status) => {
    const { api } = apiWith(async () => envelope(code, status));
    await expect(api.listAssets()).rejects.toMatchObject({
      code,
      name: "ApiError",
      status,
    });
  });

  it("does not trust an error body that is not the documented envelope", async () => {
    const { api } = apiWith(async () => json({ message: "<script>" }, 502));
    await expect(api.listAssets()).rejects.toMatchObject({
      code: "invalid-response",
      status: 502,
    });
    const html = apiWith(async () => new Response("<html>", { status: 500 }));
    await expect(html.api.listAssets()).rejects.toMatchObject({
      code: "invalid-response",
    });
  });

  it("rejects a success body that violates the contract", async () => {
    const { api } = apiWith(async () =>
      json({ assets: [{ id: "x" }], truncated: false }),
    );
    await expect(api.listAssets()).rejects.toMatchObject({
      code: "invalid-response",
      status: 200,
    });
    const extra = apiWith(async () =>
      json({ assets: [], truncated: false, extra: 1 }),
    );
    await expect(extra.api.listAssets()).rejects.toMatchObject({
      code: "invalid-response",
    });
  });

  it("reports an unreachable server as a network error and keeps aborts distinguishable", async () => {
    const { api } = apiWith(async () => {
      throw new TypeError("failed to fetch");
    });
    await expect(api.listAssets()).rejects.toMatchObject({
      code: "network",
      status: null,
    });
    const controller = new AbortController();
    controller.abort();
    const aborted = apiWith(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(
      aborted.api.listAssets({ signal: controller.signal }),
    ).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("flags only transport and server faults as retryable", () => {
    const retryable = (code: ApiErrorCode) =>
      isRetryableApiError(new ApiError(code, null, "x"));
    const transient: ApiErrorCode[] = [
      "network",
      "internal_error",
      "invalid-response",
    ];
    const permanent: ApiErrorCode[] = [
      "conflict",
      "unauthorized",
      "invalid_request",
      "forbidden",
      "not_found",
    ];
    expect(transient.map(retryable)).toEqual([true, true, true]);
    expect(permanent.map(retryable)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
