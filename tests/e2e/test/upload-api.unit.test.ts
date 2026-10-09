import { describe, expect, it, vi } from "vitest";

import {
  assetOf,
  createIntent,
  errorCode,
  intentOf,
  libraryOf,
  origin,
  post,
  type JsonPoster,
} from "../src/upload-api.ts";

const fakePoster = () => ({
  post: vi.fn<JsonPoster<string>["post"]>(async () => "sent"),
});
const json = (body: unknown) => ({ json: async () => body });
const id = "018f22f2-9c1a-7b21-8c45-000000000001";

describe("upload API test helpers", () => {
  it("reduces a base URL to its origin and refuses a missing one", () => {
    expect(origin("http://localhost:4173/some/path")).toBe(
      "http://localhost:4173",
    );
    expect(() => origin(undefined)).toThrow("base URL");
  });

  it("posts JSON with the application origin, letting a caller header override it", async () => {
    const request = fakePoster();
    await expect(
      post(
        request,
        "http://localhost:4173",
        "/x",
        { a: 1 },
        { "x-extra": "1" },
      ),
    ).resolves.toBe("sent");
    await post(
      request,
      "http://localhost:4173",
      "/x",
      {},
      { origin: "http://evil" },
    );
    expect(request.post.mock.calls).toEqual([
      [
        "/x",
        {
          data: { a: 1 },
          headers: { origin: "http://localhost:4173", "x-extra": "1" },
        },
      ],
      ["/x", { data: {}, headers: { origin: "http://evil" } }],
    ]);
  });

  it("creates an intent with a collection-artwork purpose by default and the idempotency key", async () => {
    const request = fakePoster();
    await createIntent(request, "http://localhost:4173", "key-0000000000001", {
      byteLength: 5,
      contentType: "image/png",
    });
    await createIntent(request, "http://localhost:4173", "key-0000000000002", {
      byteLength: 5,
      contentType: "image/png",
      purpose: "creator-avatar",
    });
    expect(request.post.mock.calls).toEqual([
      [
        "/api/v1/uploads/intents",
        {
          data: {
            byteLength: 5,
            contentType: "image/png",
            purpose: "collection-artwork",
          },
          headers: {
            "idempotency-key": "key-0000000000001",
            origin: "http://localhost:4173",
          },
        },
      ],
      [
        "/api/v1/uploads/intents",
        {
          data: {
            byteLength: 5,
            contentType: "image/png",
            purpose: "creator-avatar",
          },
          headers: {
            "idempotency-key": "key-0000000000002",
            origin: "http://localhost:4173",
          },
        },
      ],
    ]);
  });

  it("parses responses with the shared contract and fails on drift", async () => {
    await expect(
      errorCode(
        json({
          error: { code: "conflict", correlationId: id, message: "No." },
        }),
      ),
    ).resolves.toBe("conflict");
    await expect(errorCode(json({ error: "plain" }))).rejects.toThrow();
    await expect(
      assetOf(json({ asset: { id, processingState: "processed" } })),
    ).resolves.toEqual({ id, processingState: "processed" });
    await expect(assetOf(json({ asset: { id } }))).rejects.toThrow();
    await expect(
      libraryOf(json({ assets: [], truncated: false })),
    ).resolves.toEqual({
      assets: [],
      truncated: false,
    });
    await expect(libraryOf(json({ assets: "no" }))).rejects.toThrow();
    await expect(
      intentOf(
        json({
          intent: {
            byteLength: 5,
            contentType: "image/png",
            expiresAt: "2026-10-09T12:15:00.000Z",
            id,
            purpose: "collection-artwork",
          },
          upload: {
            expiresAt: "2026-10-09T12:15:00.000Z",
            headers: {},
            method: "PUT",
            url: "http://127.0.0.1:9000/x",
          },
        }),
      ),
    ).resolves.toMatchObject({ intent: { id } });
    await expect(intentOf(json({}))).rejects.toThrow();
  });
});
