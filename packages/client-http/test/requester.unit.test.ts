import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import { ApiError, isRetryableApiError } from "../src/api-error.ts";
import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "../src/requester.ts";

const route = { method: "POST", path: "/api/v1/things" };
const schema = z.object({ id: z.string() }).strict();
const correlationId = "018f22f2-9c1a-7b21-8c45-0000000000aa";

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
const envelope = (code: string, status: number) =>
  json({ error: { code, correlationId, message: "Nope." } }, status);

function requesterWith(respond: FetchLike) {
  const fetchImpl = vi.fn(respond);
  return { fetchImpl, request: createRequester(fetchImpl) };
}

async function failureOf(attempt: Promise<unknown>): Promise<ApiError> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
}

describe("JSON requester", () => {
  it("sends what a GET asks for as an encoded query string, and no body", async () => {
    const { fetchImpl, request } = requesterWith(async () => json({ id: "a" }));
    await request({ method: "GET", path: "/api/v1/things" }, schema, {
      query: { name: "a&b=c d", other: "é" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/things?name=a%26b%3Dc+d&other=%C3%A9",
      { headers: {}, method: "GET" },
    );
  });

  it("leaves the address alone where there is no query, or an empty one", async () => {
    const { fetchImpl, request } = requesterWith(async () => json({ id: "a" }));
    await request({ method: "GET", path: "/api/v1/things" }, schema, {
      query: {},
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/v1/things");
  });

  it("sends a JSON body and the idempotency key, and returns the validated response", async () => {
    const { fetchImpl, request } = requesterWith(async () => json({ id: "a" }));
    const result = await request(route, schema, {
      body: { name: "x" },
      idempotencyKey: "request-key-00000001",
    });
    expect(result).toEqual({ id: "a" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/things", {
      body: JSON.stringify({ name: "x" }),
      headers: {
        "content-type": "application/json",
        "idempotency-key": "request-key-00000001",
      },
      method: "POST",
    });
  });

  it("sends no body or content type when there is none, and passes the abort signal on", async () => {
    const controller = new AbortController();
    const { fetchImpl, request } = requesterWith(async () => json({ id: "a" }));
    await request({ method: "GET", path: "/api/v1/things" }, schema, {
      signal: controller.signal,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/things", {
      headers: {},
      method: "GET",
      signal: controller.signal,
    });
  });

  it.each([
    ["conflict", 409],
    ["forbidden", 403],
    ["not_found", 404],
    ["unauthorized", 401],
  ] as const)(
    "turns a %s envelope into an ApiError with that code",
    async (code, status) => {
      const { request } = requesterWith(async () => envelope(code, status));
      const error = await failureOf(request(route, schema));
      expect([
        error.code,
        error.status,
        error.message,
        error.correlationId,
      ]).toEqual([code, status, "Nope.", correlationId]);
      expect(isRetryableApiError(error)).toBe(false);
    },
  );

  it("keeps the reason the server named, and has none when it named none", async () => {
    const named = requesterWith(async () =>
      json(
        {
          error: {
            code: "conflict",
            correlationId,
            message: "Nope.",
            reason: "wallet-held",
          },
        },
        409,
      ),
    );
    expect((await failureOf(named.request(route, schema))).reason).toBe(
      "wallet-held",
    );
    const unnamed = requesterWith(async () => envelope("conflict", 409));
    expect((await failureOf(unnamed.request(route, schema))).reason).toBeNull();
  });

  it("reports too many requests as an error worth retrying later", async () => {
    const { request } = requesterWith(async () =>
      envelope("rate_limited", 429),
    );
    const error = await failureOf(request(route, schema));
    expect([error.code, error.status]).toEqual(["rate_limited", 429]);
    expect(isRetryableApiError(error)).toBe(true);
  });

  it("reports an error body that is not the documented envelope as an invalid response", async () => {
    const { request } = requesterWith(
      async () => new Response("oops", { status: 502 }),
    );
    const error = await failureOf(request(route, schema));
    expect([error.code, error.status, error.correlationId]).toEqual([
      "invalid-response",
      502,
      null,
    ]);
    expect(isRetryableApiError(error)).toBe(true);
  });

  it("reports a success body that fails the schema, or is not JSON, as an invalid response", async () => {
    const wrongShape = requesterWith(async () => json({ id: 1 }));
    expect((await failureOf(wrongShape.request(route, schema))).code).toBe(
      "invalid-response",
    );
    const notJson = requesterWith(
      async () => new Response("<html>", { status: 200 }),
    );
    expect((await failureOf(notJson.request(route, schema))).code).toBe(
      "invalid-response",
    );
  });

  it("reports a request that never got a response as a retryable network failure", async () => {
    const { request } = requesterWith(async () => {
      throw new TypeError("offline");
    });
    const error = await failureOf(request(route, schema));
    expect([error.code, error.status]).toEqual(["network", null]);
    expect(isRetryableApiError(error)).toBe(true);
  });

  it("rethrows an abort unchanged so it is not mistaken for a network failure", async () => {
    const controller = new AbortController();
    const abort = new DOMException("aborted", "AbortError");
    const { request } = requesterWith(async () => {
      controller.abort(abort);
      throw abort;
    });
    await expect(
      request(route, schema, { signal: controller.signal }),
    ).rejects.toBe(abort);
  });

  it("treats an internal error as retryable", () => {
    expect(isRetryableApiError(new ApiError("internal_error", 500, "x"))).toBe(
      true,
    );
    expect(new ApiError("network", null, "x").name).toBe("ApiError");
  });
});

describe("same-origin fetch", () => {
  it("sends the session cookie to the same origin only", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_input: string, init: RequestInit) => {
      calls.push(init);
      return json({});
    });
    await sameOriginFetch("/api/v1/x", { headers: {}, method: "GET" });
    vi.unstubAllGlobals();
    expect(calls[0]?.credentials).toBe("same-origin");
  });
});
