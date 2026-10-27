"use client";

import { mintedPictureHref } from "@ador/shared/games";

import { useImageState } from "./use-image-state.ts";

// The picture the chain serves for a minted milestone, shown through an image tag, which cannot run what a drawing holds, and kept by
// the browser. It draws nothing until the picture has come, and nothing if there is none.
export function MintedPicture({
  alt,
  claimId,
}: {
  readonly alt: string;
  readonly claimId: string;
}) {
  const src = mintedPictureHref(claimId);
  const { onError, onLoad, state } = useImageState(src);
  return (
    <img
      alt={alt}
      className="minted-picture"
      hidden={state !== "ready"}
      onError={onError}
      onLoad={onLoad}
      src={src}
    />
  );
}
