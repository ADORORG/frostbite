import { createFeatureRegistry } from "@frostbite/plugin-kit";
import { chainFeesRoute, chainIndexingRoute } from "@frostbite/shared/chain";
import { describe, expect, it } from "vitest";

import { createChainStatusFeature } from "../src/registration.ts";

const config = {
  delay: { maxLagBlocks: 2 },
  smallestStepVbytes: 200,
  feeSpeeds: {
    fast: { approxMinutes: 30, targetBlocks: 3 },
    lightning: { approxMinutes: 15, targetBlocks: 1 },
    medium: { approxMinutes: 60, targetBlocks: 6 },
    slow: { approxMinutes: 250, targetBlocks: 25 },
  },
  followed: null,
  polling: { forgetAfterMs: 600_000, refreshMs: 30_000 },
  syncWindowBlocks: 100,
};

describe("the chain status registration", () => {
  it("declares the two public routes it implements, and no page", () => {
    expect(createChainStatusFeature(config).manifest).toEqual({
      capabilities: ["api-routes"],
      dependencies: [],
      id: "chain-status",
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [chainIndexingRoute, chainFeesRoute],
      version: "1.0.0",
    });
  });

  it("loads through the shared registry with the operation its manifest declares", async () => {
    const registry = createFeatureRegistry([createChainStatusFeature(config)]);
    const loaded = await registry.load("chain-status");
    expect(loaded).toMatchObject({
      capabilities: ["api-routes"],
      id: "chain-status",
    });
    expect(loaded.operations).toHaveLength(2);
  });
});
