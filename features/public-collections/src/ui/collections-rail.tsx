import { HomeRail, HomeShelf, ShelfTile, homeRailLimit } from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";
import { homeRailCopy } from "../domain-copy.ts";
import { collectionHref, collectionsPath } from "../paths.ts";
import { CollectionCardPicture } from "./collection-card-picture.tsx";
import { collectionsUnavailable, noCollections } from "./states.tsx";

// The landing page's row of approved collections: the newest approvals first, each a small tile (picture, name, how many items), with a scene
// as the picture only where the collection has none of its own, so a creator's art is never covered. `null` means the catalog could not be
// read, which the page says (in a small tile) rather than showing it as an empty row.
export function CollectionsRail({
  cards,
}: {
  readonly cards: readonly PublicCard[] | null;
}) {
  const shown = (cards ?? []).slice(0, homeRailLimit);
  // Nothing to show (or no way to read it) is a small tile: it says so in a line and takes no scene.
  if (cards === null || shown.length === 0)
    return (
      <HomeRail
        compact
        href={collectionsPath}
        id="collections"
        summary={
          cards === null ? collectionsUnavailable.body : noCollections.body
        }
        title={homeRailCopy.title}
      />
    );
  return (
    <HomeShelf
      href={collectionsPath}
      id="collections"
      linkLabel={homeRailCopy.link(cards.length)}
      title={homeRailCopy.title}
    >
      {shown.map((card) => (
        <ShelfTile
          href={collectionHref(card.id)}
          key={card.id}
          label={`View ${card.name}`}
          media={<CollectionCardPicture card={card} />}
          meta={homeRailCopy.items(card.itemCount, card.plannedSupply)}
          title={card.name}
        />
      ))}
    </HomeShelf>
  );
}
