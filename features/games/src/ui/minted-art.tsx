"use client";

import { mintedPictureHref } from "@ador/shared/games";
import { ArcadePreview } from "@repo/ui/arcade";

import { mintedCopy } from "../domain/minted-copy.ts";
import { useImageState } from "./use-image-state.ts";

// A minted milestone's picture filling the square it is given, whether the picture has come, is coming or is not to be had (a stand-in
// drawn from the name, and said to be one), so the place never changes size. The image is asked for at once, shown when it has come,
// and gone if it fails.
export function MintedArt({
  claimId,
  name,
}: {
  readonly claimId: string;
  readonly name: string;
}) {
  const src = mintedPictureHref(claimId);
  const { onError, onLoad, state } = useImageState(src);
  return (
    <div className="minted-art" data-picture={state}>
      {state === "ready" ? null : (
        <ArcadePreview alt="" image={null} name={name} video={null} />
      )}
      {state === "none" ? (
        <span className="minted-art__caption">{mintedCopy.noPicture}</span>
      ) : (
        <img alt={name} onError={onError} onLoad={onLoad} src={src} />
      )}
    </div>
  );
}
