import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { AuthorizationPolicy } from "@ador/shared/accounts";

import {
  createDecideOperation,
  createQueueOperation,
  createReadOperation,
} from "./application/operations.ts";
import { createReviewServiceResolver } from "./runtime.ts";

export function createCollectionReviewEntrypoint(
  authorizationPolicy: AuthorizationPolicy,
): FeatureEntrypoint {
  const getService = createReviewServiceResolver(authorizationPolicy);
  return {
    capabilities: ["api-routes"],
    id: "collection-review",
    operations: [
      registerHttpOperation(createDecideOperation(getService)),
      registerHttpOperation(createQueueOperation(getService)),
      registerHttpOperation(createReadOperation(getService)),
    ],
    pages: [],
    version: "1.0.0",
  };
}
