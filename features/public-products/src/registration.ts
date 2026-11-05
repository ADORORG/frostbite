import { defineFeature } from "@frostbite/plugin-kit";

import {
  capabilitiesOf,
  creatorsCatalog,
  launchesCatalog,
  type ProductCatalog,
} from "./domain/catalog.ts";

function productFeature(catalog: ProductCatalog) {
  return defineFeature({
    manifest: {
      capabilities: capabilitiesOf(catalog),
      dependencies: [],
      navigation: [
        {
          access: { kind: "public" },
          area: catalog.navigationArea,
          href: catalog.path,
          label: catalog.label,
          order: catalog.navigationOrder,
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
      import("@frostbite/feature-public-products/entrypoint").then(
        ({ createPublicProductEntrypoint }) =>
          createPublicProductEntrypoint(catalog),
      ),
  });
}

export const launchesFeature = productFeature(launchesCatalog);
export const creatorsFeature = productFeature(creatorsCatalog);
