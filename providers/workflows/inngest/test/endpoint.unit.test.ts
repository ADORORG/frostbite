import { describe, expect, it } from "vitest";

import { createInngestEndpointFactory } from "../src/create-endpoint.ts";
import { clientWith, cloudConfig } from "./support/clients.ts";

function endpoint() {
  const calls: string[] = [];
  const handler = createInngestEndpointFactory(
    clientWith(cloudConfig),
  ).createEndpoint({
    activities: {
      processAsset: async () => (calls.push("process"), "processed"),
      validateAsset: async () => (calls.push("validate"), "validated"),
    },
    policy: { maxConcurrentMediaRuns: 2, retries: 4 },
  });
  return { calls, handler };
}

const unsigned = (method: string, path = "/api/inngest") =>
  new Request(`http://localhost${path}`, {
    ...(method === "GET"
      ? {}
      : {
          body: JSON.stringify({ ctx: {}, event: {}, events: [], steps: {} }),
        }),
    headers: { "content-type": "application/json", host: "localhost" },
    method,
  });

describe("signed workflow endpoint", () => {
  it.each(["POST", "GET"])(
    "rejects an unsigned %s request without running an activity",
    async (method) => {
      const { calls, handler } = endpoint();
      const path =
        method === "POST"
          ? "/api/inngest?fnId=probe-asset-pipeline&stepId=step"
          : "/api/inngest";
      const response = await handler(unsigned(method, path));
      expect(response.status).toBe(401);
      expect(calls).toEqual([]);
    },
  );

  it("rejects a request signed with the wrong key", async () => {
    const { calls, handler } = endpoint();
    const request = new Request(
      "http://localhost/api/inngest?fnId=probe-asset-pipeline&stepId=step",
      {
        body: JSON.stringify({ ctx: {}, event: {}, events: [], steps: {} }),
        headers: {
          "content-type": "application/json",
          host: "localhost",
          "x-inngest-signature": "t=1&s=deadbeef",
        },
        method: "POST",
      },
    );
    expect((await handler(request)).status).toBe(401);
    expect(calls).toEqual([]);
  });
});
