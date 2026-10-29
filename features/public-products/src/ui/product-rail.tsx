import { HomeRail } from "@repo/ui/arcade";

import type { ProductCatalog } from "../domain/catalog.ts";

// A product's part of the landing page. Nothing is open yet, so it is a small tile that says so in the catalog's own words (two such tiles
// share a row); when something is published its cards go here, as the other rails' do.
export function ProductRail({ catalog }: { readonly catalog: ProductCatalog }) {
  if (!catalog.homeRail) return null;
  return (
    <HomeRail
      compact
      href={catalog.path}
      id={catalog.featureId}
      summary={catalog.emptyBody}
      title={catalog.label}
    />
  );
}
