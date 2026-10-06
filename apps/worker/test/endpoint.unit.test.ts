import type { AssetPipelineActivities } from "@ador/jobs/activities";
import type { WorkflowEndpointFactory } from "@ador/jobs/provider-service";
import { describe, expect, it } from "vitest";

import { createSignedEndpointResolver } from "../src/endpoint.ts";

const policy = { maxConcurrentMediaRuns: 3, retries: 5 };
const activities: AssetPipelineActivities = {
  processAsset: async () => "processed",
  validateAsset: async () => "validated",
};

function factory(seen: {
  activities?: AssetPipelineActivities;
  policy?: typeof policy;
}): WorkflowEndpointFactory {
  return {
    createEndpoint: (input) => {
      seen.activities = input.activities;
      seen.policy = input.policy;
      return async () => new Response("served");
    },
  };
}

describe("signed endpoint resolver", () => {
  it("builds the endpoint once from the provider factory, the activities, and the policy", async () => {
    const seen: {
      activities?: AssetPipelineActivities;
      policy?: typeof policy;
    } = {};
    let built = 0;
    const resolve = createSignedEndpointResolver({
      activities: async () => activities,
      factory: async () => ((built += 1), factory(seen)),
      policy,
    });
    const first = resolve();
    expect(resolve()).toBe(first);
    const endpoint = await first;
    expect(
      await (
        await endpoint(new Request("http://localhost/api/inngest"))
      ).text(),
    ).toBe("served");
    expect([built, seen.activities, seen.policy]).toEqual([
      1,
      activities,
      policy,
    ]);
  });

  it.each([
    [
      "the provider factory",
      async () => {
        throw new Error("provider unavailable");
      },
      async () => activities,
    ],
    [
      "the activities",
      async () => factory({}),
      async () => {
        throw new Error("storage unconfigured");
      },
    ],
  ])(
    "does not cache a failure resolving %s",
    async (_name, makeFactory, makeActivities) => {
      let attempts = 0;
      const resolve = createSignedEndpointResolver({
        activities: makeActivities,
        factory: async () => ((attempts += 1), makeFactory()),
        policy,
      });
      const first = resolve();
      await expect(first).rejects.toThrow();
      const second = resolve();
      expect(second).not.toBe(first);
      await expect(second).rejects.toThrow();
      expect(attempts).toBe(2);
    },
  );

  it("recovers once the dependency becomes available", async () => {
    let available = false;
    const resolve = createSignedEndpointResolver({
      activities: async () => {
        if (!available) throw new Error("not yet");
        return activities;
      },
      factory: async () => factory({}),
      policy,
    });
    await expect(resolve()).rejects.toThrow("not yet");
    available = true;
    await expect(resolve()).resolves.toEqual(expect.any(Function));
  });
});
