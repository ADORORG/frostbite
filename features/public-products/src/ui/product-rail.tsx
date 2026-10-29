import { SceneBackdrop } from "@ador/scenes/react";
import { ArcadeEmptyState, HomeRail, StatusLamp } from "@repo/ui/arcade";

import type { ProductCatalog } from "../domain/catalog.ts";

// A product's part of the landing page. Nothing is published yet, so it says that, in the catalog's own words, over the moving
// background; when something is published its cards go here, as the other rails' do.
export function ProductRail({ catalog }: { readonly catalog: ProductCatalog }) {
  if (catalog.homeRail === null) return null;
  return (
    <HomeRail
      backdrop={<SceneBackdrop />}
      href={catalog.path}
      id={catalog.featureId}
      linkLabel={catalog.homeRail.link}
      summary={catalog.homeRail.summary}
      title={catalog.label}
    >
      <StatusLamp label="Catalog empty" tone="attention" />
      <ArcadeEmptyState title={catalog.emptyTitle}>
        {catalog.emptyBody}
      </ArcadeEmptyState>
    </HomeRail>
  );
}
