import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";

import { createIndexingOperation } from "./application/indexing.ts";
import type { ChainStatusConfig } from "./config.ts";

export function createChainStatusEntrypoint(
  config: ChainStatusConfig,
): FeatureEntrypoint {
  return {
    capabilities: ["api-routes"],
    id: "chain-status",
    operations: [registerHttpOperation(createIndexingOperation(config))],
    version: "1.0.0",
  };
}
