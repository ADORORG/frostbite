import type { PageMetadata } from "@frostbite/plugin-kit/page-metadata";

import type { ProductCatalog } from "./domain/catalog.ts";

// The catalog's page is shared under its own name. A single launch or creator has no page of its own yet, so it declares nothing and
// stays out of search results until it has one.
export function productIndexMetadata(catalog: ProductCatalog): PageMetadata {
  return {
    description: catalog.metadataDescription,
    kind: "shared",
    title: catalog.label,
  };
}
