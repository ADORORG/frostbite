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
