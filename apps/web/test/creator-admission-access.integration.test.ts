import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { createUuidV7 } from "@ador/shared/identifiers";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const resolvePageAccess = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "valid-session" }) }),
}));
vi.mock("../src/server/auth/page-access.ts", () => ({ resolvePageAccess }));

import { PUT } from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Frostbit test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});

const context = {
  params: Promise.resolve({ segments: ["creator-application", "draft"] }),
};

function request(body = "{}") {
  return new Request(
    "https://launch.example/api/v1/creator-application/draft",
    {
      body,
      headers: {
        "content-type": "application/json",
        "idempotency-key": "creator-e2e-request-0001",
        origin: "https://launch.example",
      },
      method: "PUT",
    },
  );
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(httpErrorEnvelopeSchema.parse(await response.json()).error.code).toBe(
    code,
  );
}

describe("creator admission API access decisions", () => {
  beforeEach(() => resolvePageAccess.mockReset());

  it("maps insufficient capability and dependency failure without executing", async () => {
    resolvePageAccess.mockResolvedValueOnce({ kind: "forbidden" });
    await expectError(await PUT(request(), context), 403, "forbidden");

    resolvePageAccess.mockResolvedValueOnce({ kind: "unavailable" });
    await expectError(await PUT(request(), context), 503, "internal_error");
  });

  it("passes an authorized actor while rejecting malformed input", async () => {
    resolvePageAccess.mockResolvedValue({
      actorUserId: createUuidV7(),
      kind: "allowed",
    });
    await expectError(
      await PUT(request("not-json"), context),
      400,
      "invalid_request",
    );
  });
});
