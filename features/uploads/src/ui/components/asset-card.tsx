import type { LibraryAsset } from "@frostbite/shared/uploads";
import { collectionStudioPath } from "@frostbite/shared/collections";
import { uploadDetailHref } from "@frostbite/shared/uploads";
import { ArcadeBadge, ArcadeButton, ArcadeMediaTile } from "@repo/ui/arcade";

import {
  assetBadge,
  assetNote,
  describeDimensions,
  pickRendition,
  previewPlaceholder,
  uploadedOn,
} from "../../client/asset-presentation.ts";
import { canUseInCollection } from "../../client/library-view.ts";
import { purposeLabels } from "../../client/purpose-labels.ts";

// One asset in the library: its image when there is one, its state, and a plain explanation of
// anything the user needs to act on or wait for.
export function AssetCard({ asset }: { readonly asset: LibraryAsset }) {
  const thumbnail = pickRendition(asset.derivatives, "thumbnail");
  const badge = assetBadge(asset.processingState);
  const note = assetNote(asset);
  const dimensions = describeDimensions(asset);
  const label = purposeLabels[asset.purpose];
  return (
    <ArcadeMediaTile
      caption={
        <>
          <strong>{label}</strong>
          <ArcadeBadge tone={badge.tone}>{badge.label}</ArcadeBadge>
          {dimensions === null ? null : <span>{dimensions}</span>}
          {note === null ? null : <span>{note}</span>}
          <ArcadeButton
            ariaLabel={`Details: ${label} uploaded ${uploadedOn(asset)}`}
            href={uploadDetailHref(asset.id)}
            tone="yellow"
          >
            Details
          </ArcadeButton>
          {canUseInCollection(asset) ? (
            <ArcadeButton
              ariaLabel={`Use in a collection: ${label} uploaded ${uploadedOn(asset)}`}
              href={collectionStudioPath}
            >
              Use in a collection
            </ArcadeButton>
          ) : null}
        </>
      }
      image={
        thumbnail === undefined
          ? undefined
          : {
              alt: `${label} thumbnail`,
              height: thumbnail.heightPixels,
              src: thumbnail.url,
              width: thumbnail.widthPixels,
            }
      }
      placeholder={previewPlaceholder(asset)}
    />
  );
}
