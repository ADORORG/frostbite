import { defineFeature } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { ChainOption } from "@ador/shared/chain";

import { collectionPagePath, collectionsPath } from "./paths.ts";

const access = { kind: "public" } as const;

// The public collection catalog: a list of approved collections and a page for each, from the frozen
// version that was approved. Nothing is shown for a collection that is not approved, or whose creator
// is no longer approved. The registry supplies storage for signed image previews and the chains give
// their names; removing this one registration detaches both pages and the navigation entry.
export function createPublicCollectionsFeature(
  providers: ProviderRegistry,
  chains: readonly ChainOption[],
) {
  return defineFeature({
    manifest: {
      capabilities: ["navigation", "public-page"],
      dependencies: ["collection-review"],
      id: "collections",
      navigation: [
        {
          access,
          area: "main",
          href: collectionsPath,
          label: "Collections",
          order: 10,
        },
      ],
      pages: [
        { access, path: collectionsPath },
        { access, path: collectionPagePath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: ["object-storage:s3-compatible"],
      routes: [],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-public-collections/entrypoint").then(
        ({ createPublicCollectionsEntrypoint }) =>
          createPublicCollectionsEntrypoint(providers, chains),
      ),
  });
}
