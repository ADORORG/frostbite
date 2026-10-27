"use client";

import { ArcadeBadge, ArcadePreview, CoverCard } from "@repo/ui/arcade";

import type { MintedApi } from "../client/minted-api.ts";
import { mintedCopy } from "../domain/minted-copy.ts";
import type { MintedRow } from "../domain/minted-view.ts";
import { useMintedPicture } from "./use-minted-picture.ts";

// One minted milestone as a collectible: its picture on a square that is the same size whether the picture has come, is coming or is
// not to be had (a stand-in drawn from the name, and said to be one), so the wall never jumps. The whole card leads to the game.
export function MintedCard({
  api,
  row,
}: {
  readonly api?: MintedApi;
  readonly row: MintedRow;
}) {
  const picture = useMintedPicture(row.claimId, api);
  return (
    <CoverCard
      badges={
        <>
          <ArcadeBadge tone="cyan">{row.gameTitle}</ArcadeBadge>
          {picture.kind === "ready" ? (
            <ArcadeBadge tone="yellow">
              {mintedCopy.edition(picture.edition)}
            </ArcadeBadge>
          ) : null}
        </>
      }
      cta={mintedCopy.openGame}
      href={row.gameHref}
      label={`${row.milestoneTitle}, ${row.gameTitle}`}
      media={
        <div className="minted-art" data-picture={picture.kind}>
          {picture.kind === "ready" ? (
            <img alt={row.milestoneTitle} src={picture.src} />
          ) : (
            <>
              <ArcadePreview
                alt=""
                image={null}
                name={row.milestoneTitle}
                video={null}
              />
              {picture.kind === "none" ? (
                <span className="minted-art__caption">
                  {mintedCopy.noPicture}
                </span>
              ) : null}
            </>
          )}
        </div>
      }
      ratio="square"
      summary={mintedCopy.minted(row.mintedDay)}
      title={row.milestoneTitle}
    />
  );
}
