import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import {
  ArcadeBadge,
  CoverCard,
  CoverGrid,
  shortenMiddle,
} from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";
import { collectionHref } from "../paths.ts";
import { CollectionCardPicture } from "./collection-card-picture.tsx";
import { PublicFrame } from "./public-frame.tsx";

// The approved collections, newest approval first, as a wall of covers.
export function CollectionIndex({
  cards,
  navigation,
}: {
  readonly cards: readonly PublicCard[];
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PublicFrame navigation={navigation} variant="wall">
      <header className="arcade-wall-head">
        <h2>
          Collections <span>{cards.length}</span>
        </h2>
      </header>
      <CoverGrid label="Approved collections">
        {cards.map((card) => (
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
            summary={card.description}
            title={card.name}
          />
        ))}
      </CoverGrid>
    </PublicFrame>
  );
}
