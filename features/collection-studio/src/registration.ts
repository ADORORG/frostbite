import { defineFeature } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { ChainOption } from "@ador/shared/chain";
import {
  collectionRoutes,
  collectionStudioNavigationLabel,
  collectionStudioPath,
  collectionWizardPath,
} from "@ador/shared/collections";

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

// Creator-owned collection drafts: the API, and the studio pages that list them and walk a creator
// through one (a wizard). The chains a draft may target are
// supplied explicitly (validated configuration), and the registry supplies storage for previews, so
// removing this one registration detaches the routes and their provider use.
export function createCollectionStudioFeature(
  providers: ProviderRegistry,
  targetChains: readonly ChainOption[],
) {
  return defineFeature({
    manifest: {
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "studio-page",
      ],
      dependencies: ["accounts", "creator-admission", "uploads"],
      id: "collection-studio",
      navigation: [
        {
          access: { kind: "authenticated" },
          href: collectionStudioPath,
          label: collectionStudioNavigationLabel,
        },
      ],
      pages: [
        { access: { kind: "authenticated" }, path: collectionStudioPath },
        { access: { kind: "authenticated" }, path: collectionWizardPath },
      ],
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
