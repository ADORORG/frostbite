import { defineFeature } from "@frostbite/plugin-kit";
import type { ProviderRegistry } from "@frostbite/plugin-kit/providers";
import type { ChainOption } from "@frostbite/shared/chain";
import {
  collectionImportRoute,
  collectionNewPath,
  collectionRoutes,
  collectionStudioNavigationLabel,
  collectionStudioPath,
  collectionWizardPath,
  studioHomePath,
  submissionRoutes,
} from "@frostbite/shared/collections";

// The routes, listed in a fixed order so the manifest is stable.
const routes = [
  collectionRoutes.addItem,
  collectionRoutes.create,
  collectionImportRoute,
  collectionRoutes.list,
  collectionRoutes.read,
  collectionRoutes.removeItem,
  collectionRoutes.save,
  collectionRoutes.updateItem,
  submissionRoutes.list,
  submissionRoutes.submit,
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
          area: "studio",
          href: studioHomePath,
          label: "Overview",
          order: 0,
        },
        {
          access: { kind: "authenticated" },
          area: "studio",
          href: collectionStudioPath,
          label: collectionStudioNavigationLabel,
          order: 10,
        },
      ],
      pages: [
        { access: { kind: "authenticated" }, path: studioHomePath },
        { access: { kind: "authenticated" }, path: collectionStudioPath },
        { access: { kind: "authenticated" }, path: collectionNewPath },
        { access: { kind: "authenticated" }, path: collectionWizardPath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
      routes,
      version: "1.0.0",
    },
    load: async () =>
      import("@frostbite/feature-collection-studio/entrypoint").then(
        ({ createCollectionStudioEntrypoint }) =>
          createCollectionStudioEntrypoint(providers, targetChains),
      ),
  });
}
