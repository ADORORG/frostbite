import { defineFeature } from "@frostbite/plugin-kit";
import { chainFeesRoute, chainIndexingRoute } from "@frostbite/shared/chain";

import type { ChainStatusConfig } from "./config.ts";

export type { ChainStatusConfig } from "./config.ts";

// How far the rewards chain's indexer has read, as one public route and a lamp any page can show. Removing this one registration removes
// the route; the lamp is placed by the app, so it is removed with it.
export function createChainStatusFeature(config: ChainStatusConfig) {
  return defineFeature({
    manifest: {
      capabilities: ["api-routes"],
      dependencies: [],
      id: "chain-status",
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [chainIndexingRoute, chainFeesRoute],
      version: "1.0.0",
    },
    load: async () =>
      import("@frostbite/feature-chain-status/entrypoint").then(
        ({ createChainStatusEntrypoint }) =>
          createChainStatusEntrypoint(config),
      ),
  });
}
