import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { POST } from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Frostbit test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});

const routeContext = {
  params: Promise.resolve({ segments: ["uploads", "intents"] }),
};
const completionRouteContext = {
  params: Promise.resolve({ segments: ["uploads", "intents", "complete"] }),
};

describe("upload-intent API boundary", () => {
  it("rejects unauthenticated upload authorization before provider loading", async () => {
    const response = await POST(
      new Request("https://launch.example/api/v1/uploads/intents", {
        body: JSON.stringify({
          byteLength: 100,
          contentType: "image/png",
          purpose: "creator-avatar",
        }),
        headers: {
          "content-type": "application/json",
          "idempotency-key": "upload-request-0001",
          origin: "https://launch.example",
        },
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(401);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("unauthorized");
  });

  it("rejects cross-origin upload authorization before body processing", async () => {
    const response = await POST(
      new Request("https://launch.example/api/v1/uploads/intents", {
        body: JSON.stringify({
          byteLength: -1,
          contentType: "text/html",
          purpose: "game-bundle",
        }),
        headers: {
          "content-type": "application/json",
          "idempotency-key": "upload-request-0002",
          origin: "https://attacker.example",
        },
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(403);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("forbidden");
  });

  it("rejects unauthenticated completion before storage inspection", async () => {
    const response = await POST(
      new Request("https://launch.example/api/v1/uploads/intents/complete", {
        body: JSON.stringify({
          intentId: "018f22f2-9c1a-7b21-8c45-000000000002",
        }),
        headers: {
          "content-type": "application/json",
          origin: "https://launch.example",
        },
        method: "POST",
      }),
      completionRouteContext,
    );
    expect(response.status).toBe(401);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("unauthorized");
  });
});
