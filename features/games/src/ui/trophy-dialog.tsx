"use client";

import { TransactionLink } from "@frostbite/feature-chain-status/transaction";
import type { ShareConfig } from "@frostbite/share";
import { ArcadeDialog, KeyValueList } from "@repo/ui/arcade";
import { useMemo } from "react";

import type { SharesApi } from "../client/shares-api.ts";
import { mintedCopy } from "../domain/minted-copy.ts";
import { shareCopy } from "../domain/share-copy.ts";
import type { Shelf, ShelfPiece } from "../domain/shelf-view.ts";
import { MintedArt } from "./minted-art.tsx";
import { ShareControl } from "./share-control.tsx";

// Sharing the milestone on show. A part of its own, so the request is made once for the piece and not again on every redraw of the dialog.
function PieceShare({
  api,
  config,
  piece,
  shelf,
}: {
  readonly api?: SharesApi | undefined;
  readonly config?: ShareConfig | undefined;
  readonly piece: ShelfPiece;
  readonly shelf: Shelf;
}) {
  const request = useMemo(
    () => ({
      gameId: shelf.gameId,
      kind: "milestone" as const,
      milestoneId: piece.milestoneId,
    }),
    [piece.milestoneId, shelf.gameId],
  );
  return (
    <ShareControl
      api={api}
      art={
        <MintedArt
          claimId={piece.claimId}
          cover={shelf.cover?.image ?? null}
          name={piece.title}
        />
      }
      config={config}
      heading={piece.title}
      kicker={shelf.gameTitle}
      request={request}
      variant="icon"
      text={shareCopy.post.milestone(piece.title, shelf.gameTitle)}
    />
  );
}

// A minted milestone up close: the picture large, what the milestone is, the day, and the transaction on the network's explorer.
// Closed while `open` is null.
export function TrophyDialog({
  onClose,
  open,
  share,
  sharesApi,
}: {
  readonly onClose: () => void;
  readonly open: { readonly piece: ShelfPiece; readonly shelf: Shelf } | null;
  readonly share?: ShareConfig | undefined;
  readonly sharesApi?: SharesApi | undefined;
}) {
  const piece = open?.piece;
  return (
    <ArcadeDialog
      onClose={onClose}
      open={open !== null}
      title={piece?.title ?? mintedCopy.title}
    >
      {open === null || piece === undefined ? null : (
        <div className="trophy-detail">
          <div className="trophy-detail__art">
            <MintedArt
              claimId={piece.claimId}
              cover={open.shelf.cover?.image ?? null}
              explain
              name={piece.title}
            />
            <span className="trophy-detail__share">
              <PieceShare
                api={sharesApi}
                config={share}
                piece={piece}
                shelf={open.shelf}
              />
            </span>
          </div>
          {piece.description === "" ? null : <p>{piece.description}</p>}
          <KeyValueList
            items={[
              {
                label: mintedCopy.gameLabel,
                value: <a href={open.shelf.gameHref}>{open.shelf.gameTitle}</a>,
              },
              { label: mintedCopy.mintedLabel, value: piece.mintedDay },
              {
                label: mintedCopy.transaction,
                mono: true,
                value: <TransactionLink id={piece.transactionId} />,
              },
            ]}
            label={mintedCopy.title}
          />
        </div>
      )}
    </ArcadeDialog>
  );
}
