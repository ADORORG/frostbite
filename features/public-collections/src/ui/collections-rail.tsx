import { SceneBackdrop, SceneOverlay } from "@ador/scenes/react";
import {
  ArcadeBadge,
  ArcadeEmptyState,
  CoverCard,
  CoverGrid,
  HomeRail,
  homeRailLimit,
  StatusLamp,
  shortenMiddle,
} from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";
import { homeRailCopy } from "../domain-copy.ts";
import { collectionHref, collectionsPath } from "../paths.ts";
import { CollectionPicture } from "./collection-picture.tsx";
import { collectionsUnavailable, noCollections } from "./states.tsx";

// The landing page's rail of approved collections: the newest approvals first, each card's picture with a scene over it only where the
// collection has no picture of its own, so a creator's art is never covered. `null` means the catalog could not be read, which the rail
// says rather than showing it as empty.
export function CollectionsRail({
  cards,
}: {
  readonly cards: readonly PublicCard[] | null;
}) {
  const shown = (cards ?? []).slice(0, homeRailLimit);
  return (
    <HomeRail
      backdrop={<SceneBackdrop />}
      href={collectionsPath}
      id="collections"
      linkLabel={
        cards === null
          ? homeRailCopy.linkUnknown
          : homeRailCopy.link(cards.length)
      }
      summary={homeRailCopy.summary}
      title={homeRailCopy.title}
    >
      {cards === null ? (
        <>
          <StatusLamp label="Catalog unavailable" tone="unavailable" />
          <ArcadeEmptyState title={collectionsUnavailable.title}>
            {collectionsUnavailable.body}
          </ArcadeEmptyState>
        </>
      ) : shown.length === 0 ? (
        <ArcadeEmptyState title={noCollections.title}>
          {noCollections.body}
        </ArcadeEmptyState>
      ) : (
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
              media={
                <>
                  <CollectionPicture image={card.cover} name={card.name} />
                  {card.cover === null ? <SceneOverlay seed={card.id} /> : null}
                </>
              }
              ratio="square"
              summary={card.description}
              title={card.name}
            />
          ))}
        </CoverGrid>
      )}
    </HomeRail>
  );
}
