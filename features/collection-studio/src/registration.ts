import { defineFeature } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { ChainOption } from "@ador/shared/chain";
import { collectionRoutes } from "@ador/shared/collections";

// The routes in registration order of their method and path, so the manifest is stable.
const routes = [
  collectionRoutes.addItem,
  collectionRoutes.create,
  collectionRoutes.list,
  collectionRoutes.read,
  collectionRoutes.removeItem,
  collectionRoutes.save,
  collectionRoutes.updateItem,
];

// Creator-owned collection drafts: records, items, and previews. The chains a draft may target are
// supplied explicitly (validated configuration), and the registry supplies storage for previews, so
// removing this one registration detaches the routes and their provider use.
export function createCollectionStudioFeature(
  providers: ProviderRegistry,
  targetChains: readonly ChainOption[],
) {
  return defineFeature({
    manifest: {
      capabilities: ["api-routes"],
      dependencies: ["accounts", "creator-admission", "uploads"],
      id: "collection-studio",
      navigation: [],
      pages: [],
      requiredDecisionGates: [],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
      routes,
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-collection-studio/entrypoint").then(
        ({ createCollectionStudioEntrypoint }) =>
          createCollectionStudioEntrypoint(providers, targetChains),
      ),
  });
}
