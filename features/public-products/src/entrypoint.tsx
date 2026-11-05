import type { FeatureEntrypoint } from "@frostbite/plugin-kit";

import { homeSectionOrder } from "@frostbite/shared/platform";

import {
  capabilitiesOf,
  parseProductSlug,
  type ProductCatalog,
} from "./domain/catalog.ts";
import {
  ProductDetailUnavailable,
  ProductIndex,
} from "./ui/product-surface.tsx";
import { productIndexMetadata } from "./metadata.ts";
import { ProductRail } from "./ui/product-rail.tsx";

export function createPublicProductEntrypoint(
  catalog: ProductCatalog,
): FeatureEntrypoint {
  return {
    capabilities: capabilitiesOf(catalog),
    homeSections: !catalog.homeRail
      ? []
      : [
          {
            id: catalog.featureId,
            order: homeSectionOrder.launches,
            render: () => <ProductRail catalog={catalog} />,
          },
        ],
    id: catalog.featureId,
    pages: [
      {
        access: { kind: "public" as const },
        metadata: () => productIndexMetadata(catalog),
        path: catalog.path,
        render: ({ navigation }) => (
          <ProductIndex catalog={catalog} navigation={navigation} />
        ),
      },
      {
        access: { kind: "public" as const },
        path: `${catalog.path}/[slug]` as const,
        render: ({ navigation, params }) => (
          <ProductDetailUnavailable
            catalog={catalog}
            navigation={navigation}
            slug={parseProductSlug(params.slug)}
          />
        ),
      },
    ],
    sitemapPaths: () => [catalog.path],
    version: "1.0.0",
  };
}
