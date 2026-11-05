import type { Readiness } from "@frostbite/shared/readiness";
import { describe, expect, it } from "vitest";

import { createWorkerRoutes } from "../src/routes.ts";

const readyAnswer = {
  checks: [{ latencyMs: 3, name: "database" as const, status: "ok" as const }],
  status: "ready" as const,
};

function routes(readiness: () => Promise<Readiness> = async () => readyAnswer) {
  const seen: Request[] = [];
  return {
    handle: createWorkerRoutes({
      readiness,
      endpoint: async () => async (request) => (
        seen.push(request),
        new Response("workflow", { status: 207 })
      ),
    }),
    seen,
  };
}

describe("worker routes", () => {
  it("answers liveness without touching the workflow endpoint", async () => {
    const { handle, seen } = routes();
    const response = await handle(new Request("http://worker/health"));
    expect([response.status, await response.json()]).toEqual([
      200,
      { status: "ok" },
    ]);
    expect(seen).toEqual([]);
  });

  it("only answers liveness to GET", async () => {
    const { handle } = routes();
    expect(
      (await handle(new Request("http://worker/health", { method: "POST" })))
        .status,
    ).toBe(404);
  });

  it.each(["GET", "POST", "PUT"])(
    "hands %s /api/inngest to the signed endpoint unchanged",
    async (method) => {
      const { handle, seen } = routes();
      const request = new Request("http://worker/api/inngest?fnId=a", {
        ...(method === "GET" ? {} : { body: "{}" }),
        headers: { "x-inngest-signature": "t=1&s=abc" },
        method,
      });
      const response = await handle(request);
      expect([response.status, await response.text()]).toEqual([
        207,
        "workflow",
      ]);
      expect(seen).toEqual([request]);
    },
  );

  it("answers 404 for every other path", async () => {
    const { handle, seen } = routes();
    for (const path of [
      "/",
      "/api/v1/platform",
      "/api/inngest/extra",
      "/healthz",
    ]) {
      const response = await handle(new Request(`http://worker${path}`));
      expect([path, response.status, await response.json()]).toEqual([
        path,
        404,
        { error: "not_found" },
      ]);
    }
    expect(seen).toEqual([]);
  });

  it("propagates a failure to build the endpoint so the server can answer 500", async () => {
    const handle = createWorkerRoutes({
      endpoint: async () => {
        throw new Error("provider unavailable");
      },
      readiness: async () => readyAnswer,
    });
    await expect(
      handle(new Request("http://worker/api/inngest")),
    ).rejects.toThrow("provider unavailable");
  });

  it("answers readiness 200 with each check when everything answers, uncached", async () => {
    const { handle, seen } = routes();
    const response = await handle(new Request("http://worker/ready"));
    expect([response.status, await response.json()]).toEqual([
      200,
      readyAnswer,
    ]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(seen).toEqual([]);
  });

  it("answers readiness 503 when a dependency does not answer", async () => {
    const { handle } = routes(async () => ({
      checks: [
        { latencyMs: 2000, name: "object-storage", status: "timed-out" },
      ],
      status: "not-ready",
    }));
    const response = await handle(new Request("http://worker/ready"));
    expect([response.status, (await response.json()).status]).toEqual([
      503,
      "not-ready",
    ]);
  });

  it("only answers readiness to GET", async () => {
    const { handle } = routes();
    expect(
      (await handle(new Request("http://worker/ready", { method: "POST" })))
        .status,
    ).toBe(404);
  });
});
