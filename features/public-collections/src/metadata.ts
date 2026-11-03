import {
  clipDescription,
  privatePage,
  type PageMetadata,
} from "@ador/plugin-kit/page-metadata";
import { uuidV7Schema } from "@ador/shared/identifiers";

import type { PublicCatalog } from "./application/catalog.ts";
import type { PublicCollection } from "./application/public-model.ts";
import { collectionsPath } from "./paths.ts";

export const collectionsIndexMetadata: PageMetadata = {
  description: "Collections approved for the platform, made by its creators.",
  kind: "shared",
  title: "Collections",
};

// The collections page is shared only when there is something on it and the catalog can be read.
export async function collectionsIndexPage(
  getCatalog: () => Promise<PublicCatalog>,
): Promise<PageMetadata> {
  try {
    const cards = await (await getCatalog()).index();
    return cards.length === 0 ? privatePage : collectionsIndexMetadata;
  } catch {
    return privatePage;
  }
}

// An approved collection's own name and description. One that is not valid, not approved, or cannot be read says nothing: a
// preview must never reveal that a draft or a withdrawn collection exists.
export async function collectionPage(
  getCatalog: () => Promise<PublicCatalog>,
  slug: string | undefined,
): Promise<PageMetadata> {
  const parsed = uuidV7Schema.safeParse(slug);
  if (!parsed.success) return privatePage;
  let collection: PublicCollection | null;
  try {
    collection = await (await getCatalog()).detail(parsed.data);
  } catch {
    return privatePage;
  }
  if (collection === null) return privatePage;
  return {
    description: clipDescription(
      collection.description === ""
        ? `${collection.name}, a collection on ${collection.chainLabel}.`
        : collection.description,
    ),
    // No picture of its own yet: a collection's cover is a signed, expiring address, so a preview shows the site's picture.
    kind: "shared",
    title: collection.name,
  };
}

// The collections page and each approved collection's page; nothing when there are none or the catalog cannot be read.
export async function collectionSitemapPaths(
  getCatalog: () => Promise<PublicCatalog>,
): Promise<readonly `/${string}`[]> {
  try {
    const cards = await (await getCatalog()).index();
    return cards.length === 0
      ? []
      : [
          collectionsPath,
          ...cards.map(({ id }) => `${collectionsPath}/${id}` as const),
        ];
  } catch {
    return [];
  }
}
