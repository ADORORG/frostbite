import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "../src/app/api/v1/[...segments]/route.ts";
beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Adorbitals test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});
describe("public qualification mutation boundary", () => {
  it.each([undefined, "https://attacker.example"])(
    "rejects disallowed origin %s before processing",
    async (origin) => {
      const response = await POST(
        new Request(
          "https://launch.example/api/v1/wallet-qualification/challenge",
          {
            method: "POST",
            headers: origin ? { origin } : {},
            body: "not JSON",
          },
        ),
        {
          params: Promise.resolve({
            segments: ["wallet-qualification", "challenge"],
          }),
        },
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );
  it("allows same-origin validation without requiring a session or loading the database", async () => {
    const response = await POST(
      new Request(
        "https://launch.example/api/v1/wallet-qualification/challenge",
        {
          method: "POST",
          headers: { origin: "https://launch.example" },
          body: "{}",
        },
      ),
      {
        params: Promise.resolve({
          segments: ["wallet-qualification", "challenge"],
        }),
      },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_request" },
    });
  });
});
