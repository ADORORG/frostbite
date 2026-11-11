"use client";

import { MintedArt } from "@frostbite/feature-games/minted-art";
import { galleryPictureHref } from "@frostbite/shared/games";

import type { MintItemModel } from "../domain/public-model.ts";

// The milestones a player has minted: a shelf of squares, each its picture (served by the platform's public gallery route, so it needs no
// sign-in), named under it with its game.
export function MintShelf({
  mints,
}: {
  readonly mints: readonly MintItemModel[];
}) {
  return (
    <ul className="mint-shelf">
      {mints.map((mint) => (
        <li className="mint-shelf__item" key={mint.claimId}>
          <div className="mint-shelf__frame">
            <MintedArt
              claimId={mint.claimId}
              cover={mint.game.cover?.image ?? null}
              name={mint.milestoneTitle}
              src={galleryPictureHref(mint.claimId)}
            />
          </div>
          <p className="mint-shelf__name">{mint.milestoneTitle}</p>
          <p className="mint-shelf__game">{mint.game.title}</p>
        </li>
      ))}
    </ul>
  );
}
