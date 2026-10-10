import { collectionWizardHref, standingOf } from "@ador/shared/collections";
import type { CollectionSummary } from "@ador/shared/collections";
import { ArcadeBadge, ArcadeButton, ArcadeProgress } from "@repo/ui/arcade";

import {
  nextActionLabels,
  stateLabel,
  standingTones,
} from "../../client/overview.ts";

// One collection: its monogram in the colour of its standing, what state it is in, how far along it is,
// and the one thing to do next.
export function CollectionCard({
  chainName,
  collection,
}: {
  readonly chainName: string;
  readonly collection: CollectionSummary;
}) {
  const standing = standingOf(collection.submissionState);
  const tone = standingTones[standing];
  const action = nextActionLabels[standing];
  return (
    <article className="arcade-card">
      <div className="arcade-card__head">
        <span
          aria-hidden="true"
          className={`arcade-card__avatar arcade-card__avatar--${tone}`}
        >
          {collection.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3 className="arcade-card__title">{collection.name}</h3>
          <p className="arcade-card__meta">{chainName}</p>
        </div>
      </div>
      <ArcadeBadge tone={tone}>{stateLabel(collection)}</ArcadeBadge>
      <div>
        <ArcadeProgress
          label={`${collection.name}: items added`}
          value={collection.itemCount / collection.plannedSupply}
        />
        <p className="arcade-card__meta">{`${collection.itemCount} of ${collection.plannedSupply} items`}</p>
      </div>
      <p className="arcade-card__meta">{`Updated ${collection.updatedAt.slice(0, 10)}`}</p>
      <ArcadeButton
        ariaLabel={`${action}: ${collection.name}`}
        href={collectionWizardHref(collection.id)}
        tone={tone}
      >
        {action}
      </ArcadeButton>
    </article>
  );
}
