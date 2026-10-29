import type { FeatureEntrypoint } from "@ador/plugin-kit";

import { homeSectionOrder } from "@ador/shared/platform";

import {
  capabilitiesOf,
  parseProductSlug,
  type ProductCatalog,
} from "./domain/catalog.ts";
import {
  ProductDetailUnavailable,
  ProductIndex,
} from "./ui/product-surface.tsx";
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
    version: "1.0.0",
  };
}
