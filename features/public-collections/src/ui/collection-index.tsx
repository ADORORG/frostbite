import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  CoverCard,
  CoverGrid,
  StatusLamp,
  shortenMiddle,
} from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";
import { collectionHref } from "../paths.ts";
import { CollectionPicture } from "./collection-picture.tsx";
import { PublicFrame } from "./public-frame.tsx";

// The approved collections, newest approval first, as a wall of covers. Approval is a review decision, not a launch, and the page
// says so.
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
        <StatusLamp label="Approved by review" tone="ready" />
        <h2>Collections</h2>
        <p>
          These collections passed review. Approval does not mean they are
          minted, listed, or on sale.
        </p>
      </header>
      <CoverGrid label="Approved collections">
        {cards.map((card, index) => (
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
            featured={index === 0}
            href={collectionHref(card.id)}
            key={card.id}
            label={`View ${card.name}`}
            media={<CollectionPicture image={card.cover} name={card.name} />}
            ratio="square"
            summary={card.description}
            title={card.name}
          />
        ))}
      </CoverGrid>
    </PublicFrame>
  );
}
