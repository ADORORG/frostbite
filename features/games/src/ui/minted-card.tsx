"use client";

import { mintedPictureHref } from "@ador/shared/games";
import { ArcadeBadge, ArcadePreview, CoverCard } from "@repo/ui/arcade";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { MintedRow } from "../domain/minted-view.ts";
import { useImageState } from "./use-image-state.ts";

// One minted milestone as a collectible: its picture on a square that is the same size whether the picture has come, is coming or is
// not to be had (a stand-in drawn from the name, and said to be one), so the wall never jumps. The whole card leads to the game.
export function MintedCard({ row }: { readonly row: MintedRow }) {
  const src = mintedPictureHref(row.claimId);
  const { onError, onLoad, state } = useImageState(src);
  return (
    <CoverCard
      badges={<ArcadeBadge tone="cyan">{row.gameTitle}</ArcadeBadge>}
      cta={mintedCopy.openGame}
      href={row.gameHref}
      label={`${row.milestoneTitle}, ${row.gameTitle}`}
      media={
        <div className="minted-art" data-picture={state}>
          {state === "ready" ? null : (
            <ArcadePreview
              alt=""
              image={null}
              name={row.milestoneTitle}
              video={null}
            />
          )}
          {state === "none" ? (
            <span className="minted-art__caption">{mintedCopy.noPicture}</span>
          ) : (
            // The picture is asked for at once, shown when it has come, and gone if it fails.
            <img
              alt={row.milestoneTitle}
              onError={onError}
              onLoad={onLoad}
              src={src}
            />
          )}
        </div>
      }
      ratio="square"
      summary={mintedCopy.minted(row.mintedDay)}
      title={row.milestoneTitle}
    />
  );
}
