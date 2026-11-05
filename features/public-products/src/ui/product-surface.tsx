import {
  AppShell,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";

import type { ProductCatalog } from "../domain/catalog.ts";

export function ProductIndex({
  catalog,
  navigation,
}: {
  readonly catalog: ProductCatalog;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <AppShell homeHref="/" navigation={navigation}>
      <section className="arcade-section arcade-section--catalog">
        <ArcadePanel title={catalog.emptyTitle}>
          <p>{catalog.emptyBody}</p>
          <ArcadeButton href="/" tone="cyan">
            Return home
          </ArcadeButton>
        </ArcadePanel>
      </section>
    </AppShell>
  );
}

export function ProductDetailUnavailable({
  catalog,
  navigation,
  slug,
}: {
  readonly catalog: ProductCatalog;
  readonly navigation: readonly NavigationItem[];
  readonly slug: string | null;
}) {
  const valid = slug !== null;
  return (
    <AppShell homeHref="/" navigation={navigation}>
      <section className="arcade-section arcade-section--catalog">
        <StatusLamp
          label={valid ? "Record not published" : "Invalid identifier"}
          tone="unavailable"
        />
        <ArcadePanel
          eyebrow={`${catalog.label} detail`}
          title={valid ? `${catalog.detailNoun} unavailable` : "Invalid route"}
        >
          <p>
            {valid
              ? `No published ${catalog.detailNoun} matches “${slug}”.`
              : `This ${catalog.detailNoun} identifier is not valid.`}
          </p>
          <ArcadeButton href={catalog.path} tone="cyan">
            Browse {catalog.label.toLowerCase()}
          </ArcadeButton>
        </ArcadePanel>
      </section>
    </AppShell>
  );
}
