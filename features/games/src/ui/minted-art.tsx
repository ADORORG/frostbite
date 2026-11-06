"use client";

import { mintedPictureHref } from "@frostbite/shared/games";

import { mintedCopy } from "../domain/minted-copy.ts";
import { Medallion } from "./medallion.tsx";
import { useImageState } from "./use-image-state.ts";

// A minted milestone's picture filling the square it is given. Until the picture has come, and for good when none is to be had, the
// square holds a medallion instead, so the place never changes size and a mint without a picture still looks like a trophy. The image
// is asked for at once, shown when it has come, and gone if it fails. `explain` says in words that the medallion is a stand-in.
export function MintedArt({
  claimId,
  cover,
  explain = false,
  name,
}: {
  readonly claimId: string;
  readonly cover: string | null;
  readonly explain?: boolean;
  readonly name: string;
}) {
  const src = mintedPictureHref(claimId);
  const { onError, onLoad, state } = useImageState(src);
  return (
    <div className="minted-art" data-picture={state}>
      {state === "ready" ? null : <Medallion cover={cover} name={name} />}
      {state === "none" ? (
        explain ? (
          <span className="minted-art__caption">{mintedCopy.standIn}</span>
        ) : null
      ) : (
        <img alt={name} onError={onError} onLoad={onLoad} src={src} />
      )}
    </div>
  );
}
