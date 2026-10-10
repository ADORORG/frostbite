import { defineFeature } from "@ador/plugin-kit";

import {
  creatorsCatalog,
  gamesCatalog,
  launchesCatalog,
  type ProductCatalog,
} from "./domain/catalog.ts";

function productFeature(catalog: ProductCatalog) {
  return defineFeature({
    manifest: {
      capabilities: ["navigation", "public-page"],
      dependencies: [],
      navigation: [
        {
          access: { kind: "public" },
          href: catalog.path,
          label: catalog.label,
        },
      ],
      id: catalog.featureId,
      pages: [
        { access: { kind: "public" }, path: catalog.path },
        { access: { kind: "public" }, path: `${catalog.path}/[slug]` },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-public-products/entrypoint").then(
        ({ createPublicProductEntrypoint }) =>
          createPublicProductEntrypoint(catalog),
      ),
  });
}

export const launchesFeature = productFeature(launchesCatalog);
export const creatorsFeature = productFeature(creatorsCatalog);
export const gamesFeature = productFeature(gamesCatalog);
