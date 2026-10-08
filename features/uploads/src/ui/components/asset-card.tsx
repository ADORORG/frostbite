import type { LibraryAsset } from "@ador/shared/uploads";
import { ArcadeBadge, ArcadeMediaTile } from "@repo/ui/arcade";

import {
  assetBadge,
  assetNote,
  describeDimensions,
  pickRendition,
} from "../../client/asset-presentation.ts";
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
      placeholder={
        asset.processingState === "processed"
          ? "Preview unavailable"
          : "No preview yet"
      }
    />
  );
}
