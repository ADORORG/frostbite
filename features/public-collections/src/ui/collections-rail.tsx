import { SceneBackdrop } from "@ador/scenes/react";
import {
  ArcadeBadge,
  CoverCard,
  CoverGrid,
  HomeRail,
  homeRailLimit,
  shortenMiddle,
} from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";
import { homeRailCopy } from "../domain-copy.ts";
import { collectionHref, collectionsPath } from "../paths.ts";
import { CollectionCardPicture } from "./collection-card-picture.tsx";
import { collectionsUnavailable, noCollections } from "./states.tsx";

// The landing page's rail of approved collections: the newest approvals first, each card's picture with a scene over it only where the
// collection has no picture of its own, so a creator's art is never covered. `null` means the catalog could not be read, which the rail
// says (in a small tile) rather than showing it as a band of cards.
export function CollectionsRail({
  cards,
}: {
  readonly cards: readonly PublicCard[] | null;
}) {
  const shown = (cards ?? []).slice(0, homeRailLimit);
  // Nothing to show (or no way to read it) is a small tile, not a band: it says so in a line and takes no scene.
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
    <HomeRail
      backdrop={<SceneBackdrop />}
      href={collectionsPath}
      id="collections"
      linkLabel={homeRailCopy.link(cards.length)}
      summary={homeRailCopy.summary}
      title={homeRailCopy.title}
    >
      <CoverGrid label={homeRailCopy.title}>
        {shown.map((card) => (
          <CoverCard
            badges={
              <>
                <span title={card.chainLabel}>
                  <ArcadeBadge tone="cyan">
                    {shortenMiddle(card.chainLabel, { head: 14, tail: 6 })}
                  </ArcadeBadge>
                </span>
                <ArcadeBadge tone="yellow">
                  {`${String(card.itemCount)} of ${card.plannedSupply.toLocaleString("en-US")} items`}
                </ArcadeBadge>
              </>
            }
            cta="View collection"
            href={collectionHref(card.id)}
            key={card.id}
            label={`View ${card.name}`}
            media={<CollectionCardPicture card={card} />}
            ratio="wide"
            summary={card.description}
            title={card.name}
          />
        ))}
      </CoverGrid>
    </HomeRail>
  );
}
