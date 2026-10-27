import { describe, expect, it } from "vitest";

import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { platformStatusSchema } from "@ador/shared/platform";

import { featureRegistry } from "../../../configs/features";
import { GET, POST } from "../src/app/api/v1/[...segments]/route.js";

const routeContext = { params: Promise.resolve({ segments: ["platform"] }) };

const correlationId = "123e4567-e89b-42d3-a456-426614174000";

describe("Next platform API adapter", () => {
  it("generates a correlation ID when the caller omits one", async () => {
    const response = await GET(
      new Request("http://platform.invalid/api/v1/platform"),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("serves the shared versioned operation", async () => {
    const response = await GET(
      new Request("http://platform.invalid/api/v1/platform", {
        headers: { "x-correlation-id": correlationId },
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(platformStatusSchema.parse(await response.json())).toEqual({
      apiVersion: "v1",
      // The registry's own count, so adding a feature does not break this test.
      registeredFeatures: featureRegistry.list().length,
      stage: "foundation",
      transactionalActions: "gated",
    });
  });

  it("lets a browser keep the status and ask only whether it changed, and says nothing changed when it did not", async () => {
    const url = "http://platform.invalid/api/v1/platform";
    const first = await GET(new Request(url), routeContext);
    const tag = first.headers.get("etag");
    expect(first.headers.get("cache-control")).toBe("public, no-cache");
    expect(first.headers.get("content-type")).toBe("application/json");
    expect(tag).toMatch(/^"[A-Za-z0-9_-]{43}"$/u);
    const again = await GET(
      new Request(url, { headers: { "if-none-match": tag ?? "" } }),
      routeContext,
    );
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
    const changed = await GET(
      new Request(url, { headers: { "if-none-match": '"something-else"' } }),
      routeContext,
    );
    expect(changed.status).toBe(200);
    expect(await changed.json()).toEqual(await first.clone().json());
  });

  it("keeps no error answer", async () => {
    const response = await GET(
      new Request("http://platform.invalid/api/v1/platform", {
        headers: { "if-none-match": "*", "x-correlation-id": "invalid" },
      }),
      routeContext,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("etag")).toBeNull();
  });

  it("returns the shared safe error envelope", async () => {
    const response = await GET(
      new Request("http://platform.invalid/api/v1/platform", {
        headers: { "x-correlation-id": "invalid" },
      }),
      routeContext,
    );
    expect(response.status).toBe(400);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("invalid_request");
  });

  it("returns the shared envelope for unsupported methods", async () => {
    const response = await POST(
      new Request("http://platform.invalid/api/v1/platform", {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(405);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("method_not_allowed");
  });

  it("returns the shared envelope for an unregistered path", async () => {
    const response = await GET(
      new Request("http://platform.invalid/api/v1/missing"),
      { params: Promise.resolve({ segments: ["missing"] }) },
    );
    expect(response.status).toBe(404);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("not_found");
  });
});
