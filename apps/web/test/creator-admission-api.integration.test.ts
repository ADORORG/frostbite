import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { GET, PUT } from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Frostbite test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});

describe("creator admission API authentication boundary", () => {
  it("rejects a cookieless private application read", async () => {
    const response = await GET(
      new Request("https://launch.example/api/v1/creator-application"),
      { params: Promise.resolve({ segments: ["creator-application"] }) },
    );
    expect(response.status).toBe(401);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("unauthorized");
  });

  it("rejects cross-origin mutations before session or body processing", async () => {
    const response = await PUT(
      new Request("https://launch.example/api/v1/creator-application/draft", {
        headers: { origin: "https://attacker.example" },
        method: "PUT",
      }),
      {
        params: Promise.resolve({
          segments: ["creator-application", "draft"],
        }),
      },
    );
    expect(response.status).toBe(403);
    expect(
      httpErrorEnvelopeSchema.parse(await response.json()).error.code,
    ).toBe("forbidden");
  });
});
