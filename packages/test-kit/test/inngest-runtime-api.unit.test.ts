import { createServer } from "node:http";

import { describe, expect, it } from "vitest";

import type { InngestRuntime } from "../src/inngest-runtime.ts";
import { runtimeApi } from "../src/inngest-runtime-api.ts";

// A fake REST surface shaped like the runtime's: events with internal ids, runs per internal id.
async function fakeRuntime(
  handler: (path: string) => { body: unknown; status: number },
) {
  const server = createServer((request, response) => {
    const { body, status } = handler(request.url ?? "");
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("no port");
  const runtime: InngestRuntime = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    eventKey: "e",
    logs: async () => "",
    signingKey: "s",
    stop: async () => undefined,
  };
  return {
    runtime,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("runtime REST reader", () => {
  it("gathers runs across every event record that shares an id", async () => {
    const { runtime, stop } = await fakeRuntime((path) =>
      path === "/v1/events"
        ? {
            body: {
              data: [
                { id: "e1", internal_id: "i1" },
                { id: "e1", internal_id: "i2" },
                { id: "other", internal_id: "i3" },
              ],
            },
            status: 200,
          }
        : {
            body: {
              data: path.includes("/i2/") ? [{ status: "Completed" }] : [],
            },
            status: 200,
          },
    );
    try {
      const api = runtimeApi(runtime, "s");
      expect(await api.eventRecordCount("e1")).toBe(2);
      expect(await api.runCount("e1")).toBe(1);
      expect(await api.status("e1")).toBe("Completed");
      expect(await api.waitForStatus("e1", "Completed")).toBe("Completed");
      expect(await api.runCount("other")).toBe(0);
      expect(await api.status("other")).toBeUndefined();
    } finally {
      await stop();
    }
  });

  it("keeps waiting while the status differs and reports a timeout", async () => {
    const { runtime, stop } = await fakeRuntime((path) =>
      path === "/v1/events"
        ? { body: { data: [{ id: "e1", internal_id: "i1" }] }, status: 200 }
        : { body: { data: [{ status: "Failed" }] }, status: 200 },
    );
    try {
      expect(await runtimeApi(runtime, "s").status("e1")).toBe("Failed");
    } finally {
      await stop();
    }
  });

  it("sends the signing key as a bearer token and surfaces a rejection", async () => {
    const { runtime, stop } = await fakeRuntime(() => ({
      body: {},
      status: 401,
    }));
    try {
      await expect(
        runtimeApi(runtime, "s").eventRecordCount("e1"),
      ).rejects.toThrow("/v1/events answered 401");
    } finally {
      await stop();
    }
  });
});
