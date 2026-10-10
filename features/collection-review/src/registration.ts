import { defineFeature } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { AuthorizationPolicy } from "@ador/shared/accounts";
import {
  collectionReviewActivityPath,
  collectionReviewCapability,
  collectionReviewDetailPath,
  collectionReviewNavigationLabel,
  collectionReviewQueuePath,
  reviewRoutes,
} from "@ador/shared/collections";

const access = {
  capability: collectionReviewCapability,
  kind: "platform",
} as const;

// Staff review of submitted collections: the review queue, one submission in full with its images, and
// decisions, as API routes and two admin pages. Which platform roles may decide comes from the
// authorization policy passed in, and the registry supplies storage for the image previews, so removing
// this one registration detaches every review route and page.
export function createCollectionReviewFeature(
  authorizationPolicy: AuthorizationPolicy,
  providers: ProviderRegistry,
) {
  return defineFeature({
    manifest: {
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "studio-page",
      ],
      dependencies: ["accounts", "collection-studio", "uploads"],
      id: "collection-review",
      navigation: [
        {
          access,
          href: collectionReviewQueuePath,
          label: collectionReviewNavigationLabel,
        },
      ],
      pages: [
        { access, path: collectionReviewQueuePath },
        { access, path: collectionReviewActivityPath },
        { access, path: collectionReviewDetailPath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
      routes: [
        reviewRoutes.activity,
        reviewRoutes.decide,
        reviewRoutes.queue,
        reviewRoutes.read,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-collection-review/entrypoint").then(
        ({ createCollectionReviewEntrypoint }) =>
          createCollectionReviewEntrypoint(authorizationPolicy, providers),
      ),
  });
}
