import { defineFeature } from "@ador/plugin-kit";
import type { AuthorizationPolicy } from "@ador/shared/accounts";
import { reviewRoutes } from "@ador/shared/collections";

// Staff review of submitted collections: the review queue, a submission in full, and decisions. It
// contributes API routes only for now (the review page is a later task). Which platform roles may
// decide comes from the authorization policy passed in, so removing this one registration detaches
// every review route and nothing else changes.
export function createCollectionReviewFeature(
  authorizationPolicy: AuthorizationPolicy,
) {
  return defineFeature({
    manifest: {
      capabilities: ["api-routes"],
      dependencies: ["accounts", "collection-studio"],
      id: "collection-review",
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [reviewRoutes.decide, reviewRoutes.queue, reviewRoutes.read],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-collection-review/entrypoint").then(
        ({ createCollectionReviewEntrypoint }) =>
          createCollectionReviewEntrypoint(authorizationPolicy),
      ),
  });
}
