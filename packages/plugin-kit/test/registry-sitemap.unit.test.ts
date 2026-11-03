import { describe, expect, it } from "vitest";

import type {
  FeatureEntrypoint,
  FeatureRegistration,
} from "../src/registry.js";
import { createFeatureRegistry } from "../src/registry.js";

function feature(
  id: string,
  sitemapPaths?: FeatureEntrypoint["sitemapPaths"],
): FeatureRegistration {
  return {
    manifest: {
      capabilities: ["scheduled-workflows"],
      dependencies: [],
      id,
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [],
      version: "1.0.0",
    },
    load: async () => ({
      capabilities: ["scheduled-workflows"],
      id,
      ...(sitemapPaths === undefined ? {} : { sitemapPaths }),
      version: "1.0.0",
    }),
  };
}

describe("the sitemap's addresses", () => {
  it("are every feature's own, each once, in a stable order", async () => {
    const registry = createFeatureRegistry([
      feature("games", () => ["/games/b", "/games", "/games/a"]),
      feature("collections", async () => ["/collections", "/games"]),
      feature("silent"),
    ]);
    expect(await registry.listSitemapPaths()).toEqual([
      "/collections",
      "/games",
      "/games/a",
      "/games/b",
    ]);
  });

  it("are empty when no feature lists any", async () => {
    expect(
      await createFeatureRegistry([feature("silent")]).listSitemapPaths(),
    ).toEqual([]);
  });
});
