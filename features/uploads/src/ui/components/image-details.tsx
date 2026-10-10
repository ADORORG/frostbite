import { collectionStudioPath } from "@ador/shared/collections";
import type { LibraryAsset } from "@ador/shared/uploads";
import { uploadsStudioPath } from "@ador/shared/uploads";
import { ArcadeBadge, ArcadeButton, ArcadeMediaTile } from "@repo/ui/arcade";

import {
  assetBadge,
  assetNote,
  describeDimensions,
  pickRendition,
} from "../../client/asset-presentation.ts";
import { canUseInCollection } from "../../client/library-view.ts";
import { purposeLabels } from "../../client/purpose-labels.ts";

// One image in full: the largest picture there is, what it is for, its state, size, and date, and the
// ways onward. It claims nothing the library does not know, such as where the image is used.
export function ImageDetails({ asset }: { readonly asset: LibraryAsset }) {
  const picture =
    pickRendition(asset.derivatives, "preview") ??
    pickRendition(asset.derivatives, "thumbnail");
  const badge = assetBadge(asset.processingState);
  const note = assetNote(asset);
  const dimensions = describeDimensions(asset);
  const facts: readonly (readonly [string, string])[] = [
    ["Uploaded", asset.createdAt.slice(0, 10)],
    ...(dimensions === null ? [] : [["Size", dimensions] as const]),
  ];
  return (
    <article aria-label="Image details" className="arcade-stack">
      <ArcadeMediaTile
        caption={<strong>{purposeLabels[asset.purpose]}</strong>}
        image={
          picture === undefined
            ? undefined
            : {
                alt: `${purposeLabels[asset.purpose]} preview`,
                height: picture.heightPixels,
                src: picture.url,
                width: picture.widthPixels,
              }
        }
        placeholder={
          asset.processingState === "processed"
            ? "Preview unavailable"
            : "No preview yet"
        }
      />
      <ArcadeBadge tone={badge.tone}>{badge.label}</ArcadeBadge>
      {note === null ? null : <p>{note}</p>}
      <dl className="arcade-details">
        {facts.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="arcade-actions">
        {canUseInCollection(asset) ? (
          <ArcadeButton href={collectionStudioPath} tone="mint">
            Use in a collection
          </ArcadeButton>
        ) : null}
        <ArcadeButton href={uploadsStudioPath}>
          Back to your library
        </ArcadeButton>
      </div>
    </article>
  );
}
