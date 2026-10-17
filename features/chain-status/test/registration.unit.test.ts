import { createFeatureRegistry } from "@ador/plugin-kit";
import { chainIndexingRoute } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import { createChainStatusFeature } from "../src/registration.ts";

const config = {
  delay: { maxLagBlocks: 2 },
  followed: null,
  refreshMs: 30_000,
};

describe("the chain status registration", () => {
  it("declares the one public route it implements, and no page", () => {
    expect(createChainStatusFeature(config).manifest).toEqual({
      capabilities: ["api-routes"],
      dependencies: [],
      id: "chain-status",
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [chainIndexingRoute],
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
    expect(loaded.operations).toHaveLength(1);
  });
});
