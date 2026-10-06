import { describe, expect, it } from "vitest";

import { serveFetchHandler } from "../src/serve-fetch-handler.ts";

describe("fetch handler server", () => {
  it("serves a fetch-style handler over HTTP and records each exchange", async () => {
    const seen: string[] = [];
    const served = await serveFetchHandler(async (request) => {
      seen.push(
        `${request.method} ${new URL(request.url).pathname} ${await request.text()}`,
      );
      return new Response("answer", { status: 202 });
    });
    try {
      const post = await fetch(
        `http://127.0.0.1:${served.port}/api/inngest?fn=a`,
        {
          body: '{"k":1}',
          headers: { "x-inngest-signature": "t=1&s=abc" },
          method: "POST",
        },
      );
      expect([post.status, await post.text()]).toEqual([202, "answer"]);
      expect(
        (await fetch(`http://127.0.0.1:${served.port}/health`)).status,
      ).toBe(202);
      expect(seen).toEqual(['POST /api/inngest {"k":1}', "GET /health "]);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(served.requests).toEqual([
        {
          method: "POST",
          path: "/api/inngest",
          rawBody: '{"k":1}',
          signature: "t=1&s=abc",
          status: 202,
        },
        {
          method: "GET",
          path: "/health",
          rawBody: "",
          signature: undefined,
          status: 202,
        },
      ]);
    } finally {
      await served.stop();
    }
  });

  it("stops accepting connections", async () => {
    const served = await serveFetchHandler(async () => new Response("ok"));
    await served.stop();
    await expect(fetch(`http://127.0.0.1:${served.port}/`)).rejects.toThrow();
  });
});
