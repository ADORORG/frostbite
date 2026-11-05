import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";

import { createFeesOperation } from "./application/fees.ts";
import { createIndexingOperation } from "./application/indexing.ts";
import type { ChainStatusConfig } from "./config.ts";

export function createChainStatusEntrypoint(
  config: ChainStatusConfig,
): FeatureEntrypoint {
  return {
    capabilities: ["api-routes"],
    id: "chain-status",
    operations: [
      registerHttpOperation(createIndexingOperation(config)),
      registerHttpOperation(createFeesOperation(config)),
    ],
    version: "1.0.0",
  };
}
