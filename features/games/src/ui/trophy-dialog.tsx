"use client";

import { TransactionLink } from "@ador/feature-chain-status/transaction";
import { ArcadeDialog, KeyValueList } from "@repo/ui/arcade";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { Shelf, ShelfPiece } from "../domain/shelf-view.ts";
import { MintedArt } from "./minted-art.tsx";

// A minted milestone up close: the picture large, what the milestone is, the day, and the transaction on the network's explorer.
// Closed while `open` is null.
export function TrophyDialog({
  onClose,
  open,
}: {
  readonly onClose: () => void;
  readonly open: { readonly piece: ShelfPiece; readonly shelf: Shelf } | null;
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
            <MintedArt claimId={piece.claimId} name={piece.title} />
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
