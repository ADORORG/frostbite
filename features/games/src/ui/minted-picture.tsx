"use client";

import type { MintedApi } from "../client/minted-api.ts";
import { useMintedPicture } from "./use-minted-picture.ts";

// The picture the chain serves for a minted milestone, shown through an image tag, which cannot run what a drawing holds. It draws
// nothing until the platform has the picture, and nothing if there is none.
export function MintedPicture({
  alt,
  api,
  claimId,
}: {
  readonly alt: string;
  readonly api?: MintedApi;
  readonly claimId: string;
}) {
  const picture = useMintedPicture(claimId, api);
  return picture === null ? null : (
    <img alt={alt} className="minted-picture" src={picture.src} />
  );
}
