import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadeMediaTile,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicCard } from "../application/public-model.ts";
import { collectionHref } from "../paths.ts";
import { PublicFrame } from "./public-frame.tsx";

// The approved collections, newest approval first. Approval is a review decision, not a launch, and
// the page says so.
export function CollectionIndex({
  cards,
  navigation,
}: {
  readonly cards: readonly PublicCard[];
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <PublicFrame navigation={navigation}>
      <StatusLamp label="Approved by review" tone="ready" />
      <ArcadePanel eyebrow="Public catalog" title="Collections">
        <p>
          These collections passed review. Approval does not mean they are
          minted, listed, or on sale.
        </p>
        <ul aria-label="Approved collections" className="arcade-grid">
          {cards.map((card) => (
            <li key={card.id}>
              <article aria-label={card.name}>
                <ArcadeMediaTile
                  caption={
                    <>
                      <strong>{card.name}</strong>
                      <span>{card.chainLabel}</span>
                      <ArcadeBadge tone="cyan">
                        {`${String(card.itemCount)} of ${card.plannedSupply.toLocaleString("en-US")} items`}
                      </ArcadeBadge>
                    </>
                  }
                  image={card.cover ?? undefined}
                  placeholder="Preview unavailable"
                />
                <p>{card.description}</p>
                <ArcadeButton href={collectionHref(card.id)} tone="mint">
                  {`View ${card.name}`}
                </ArcadeButton>
              </article>
            </li>
          ))}
        </ul>
      </ArcadePanel>
    </PublicFrame>
  );
}
