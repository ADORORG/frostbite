import {
  collectionStandingLabels,
  collectionStandings,
  collectionNewPath,
  collectionStudioPath,
  type CollectionSummary,
} from "@ador/shared/collections";
import type { LibraryAsset } from "@ador/shared/uploads";
import { uploadsStudioPath } from "@ador/shared/uploads";
import { ArcadeBadge, ArcadeButton } from "@repo/ui/arcade";

import { countByStanding } from "../../client/overview.ts";
import type { StandingCopy } from "../../client/creator-standing.ts";

// The cards of the studio home. Each takes what it shows, so each is tested without loading anything.

export function StandingCard({
  standing,
}: {
  readonly standing: StandingCopy;
}) {
  return (
    <article className="arcade-card">
      <p className="arcade-eyebrow">Your standing</p>
      <h3 className="arcade-card__title">{standing.headline}</h3>
      <ArcadeBadge tone={standing.tone}>
        {standing.canCreate
          ? "Can build collections"
          : "Cannot build collections yet"}
      </ArcadeBadge>
      <p className="arcade-card__meta">{standing.body}</p>
      {standing.action === null ? null : (
        <ArcadeButton href={standing.action.href} tone={standing.tone}>
          {standing.action.label}
        </ArcadeButton>
      )}
    </article>
  );
}

export function CollectionsCard({
  canCreate,
  collections,
}: {
  readonly canCreate: boolean;
  readonly collections: readonly CollectionSummary[];
}) {
  const counts = countByStanding(collections);
  return (
    <article className="arcade-card">
      <p className="arcade-eyebrow">Collections</p>
      <h3 className="arcade-card__title">
        {collections.length === 0
          ? "None yet"
          : `${collections.length} ${collections.length === 1 ? "collection" : "collections"}`}
      </h3>
      <ul aria-label="Collections by standing" className="arcade-card__list">
        {collectionStandings.flatMap((standing) => {
          const count = counts.get(standing) ?? 0;
          return count === 0
            ? []
            : [
                <li key={standing}>
                  {`${collectionStandingLabels[standing]}: ${count}`}
                </li>,
              ];
        })}
      </ul>
      <div className="arcade-actions">
        <ArcadeButton href={collectionStudioPath} tone="cyan">
          Open collections
        </ArcadeButton>
        {canCreate ? (
          <ArcadeButton href={collectionNewPath} tone="mint">
            New collection
          </ArcadeButton>
        ) : null}
      </div>
    </article>
  );
}

export function ImagesCard({
  assets,
  truncated,
}: {
  readonly assets: readonly LibraryAsset[];
  readonly truncated: boolean;
}) {
  const ready = assets.filter(
    ({ processingState }) => processingState === "processed",
  ).length;
  const rejected = assets.filter(
    ({ processingState }) => processingState === "rejected",
  ).length;
  const processing = assets.length - ready - rejected;
  const more = truncated ? "+" : "";
  return (
    <article className="arcade-card">
      <p className="arcade-eyebrow">Images</p>
      <h3 className="arcade-card__title">
        {assets.length === 0 ? "None yet" : `${ready}${more} ready`}
      </h3>
      {processing > 0 ? (
        <p className="arcade-card__meta">{`${processing} still processing`}</p>
      ) : null}
      {rejected > 0 ? (
        <p className="arcade-card__meta">{`${rejected} not accepted`}</p>
      ) : null}
      <ArcadeButton href={uploadsStudioPath} tone="cyan">
        Open uploads
      </ArcadeButton>
    </article>
  );
}
