import { createUploadsContextResolver } from "@ador/feature-uploads/context";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ProviderRegistry } from "@ador/plugin-kit/providers";
import type { ChainOption } from "@ador/shared/chain";
import { uuidV7Schema } from "@ador/shared/identifiers";

import { homeSectionOrder } from "@ador/shared/platform";

import type { PublicCatalog } from "./application/catalog.ts";
import { collectionPagePath, collectionsPath } from "./paths.ts";
import { createCatalogResolver } from "./runtime.ts";
import { CollectionDetail } from "./ui/collection-detail.tsx";
import { CollectionIndex } from "./ui/collection-index.tsx";
import { CollectionsRail } from "./ui/collections-rail.tsx";
import {
  CatalogUnavailable,
  CollectionNotPublished,
  NoCollections,
} from "./ui/states.tsx";

export function createPublicCollectionsEntrypoint(
  providers: ProviderRegistry,
  chains: readonly ChainOption[],
): FeatureEntrypoint {
  const getCatalog = createCatalogResolver(
    createUploadsContextResolver(providers),
    chains,
  );
  const access = { kind: "public" } as const;

  async function index(
    navigation: Parameters<typeof NoCollections>[0]["navigation"],
  ) {
    try {
      const catalog: PublicCatalog = await getCatalog();
      const cards = await catalog.index();
      return cards.length === 0 ? (
        <NoCollections navigation={navigation} />
      ) : (
        <CollectionIndex cards={cards} navigation={navigation} />
      );
    } catch {
      return <CatalogUnavailable navigation={navigation} />;
    }
  }

  async function detail(
    navigation: Parameters<typeof NoCollections>[0]["navigation"],
    slug: string | undefined,
  ) {
    const parsed = uuidV7Schema.safeParse(slug);
    if (!parsed.success)
      return <CollectionNotPublished navigation={navigation} valid={false} />;
    try {
      const collection = await (await getCatalog()).detail(parsed.data);
      return collection === null ? (
        <CollectionNotPublished navigation={navigation} valid />
      ) : (
        <CollectionDetail collection={collection} navigation={navigation} />
      );
    } catch {
      return <CatalogUnavailable navigation={navigation} />;
    }
  }

  // The landing page's rail. A catalog that cannot be read is said to be unavailable, not shown as empty.
  async function rail() {
    try {
      return <CollectionsRail cards={await (await getCatalog()).index()} />;
    } catch {
      return <CollectionsRail cards={null} />;
    }
  }

  return {
    capabilities: ["home-section", "navigation", "public-page"],
    homeSections: [
      { id: "collections", order: homeSectionOrder.collections, render: rail },
    ],
    id: "collections",
    pages: [
      {
        access,
        path: collectionsPath,
        render: ({ navigation }) => index(navigation),
      },
      {
        access,
        path: collectionPagePath,
        render: ({ navigation, params }) => detail(navigation, params.slug),
      },
    ],
    version: "1.0.0",
  };
}
