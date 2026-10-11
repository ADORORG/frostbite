import { beforeEach, describe, expect, it, vi } from "vitest";

const getReadiness = vi.fn();
vi.mock("../src/server/readiness", () => ({ getReadiness }));
const { GET } = await import("../src/app/api/ready/route");

beforeEach(() => getReadiness.mockReset());

describe("the readiness endpoint", () => {
  it("answers 200 when every check passes, and never lets the answer be cached", async () => {
    const ready = {
      checks: [{ latencyMs: 4, name: "database", status: "ok" }],
      status: "ready",
    };
    getReadiness.mockResolvedValue(ready);
    const response = await GET();
    expect([response.status, await response.json()]).toEqual([200, ready]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 when any check does not pass", async () => {
    getReadiness.mockResolvedValue({
      checks: [
        { latencyMs: 2000, name: "object-storage", status: "timed-out" },
      ],
      status: "not-ready",
    });
    expect((await GET()).status).toBe(503);
  });
});
