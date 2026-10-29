"use client";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { ShelfPiece } from "../domain/shelf-view.ts";
import { MintedArt } from "./minted-art.tsx";

// One minted milestone on a shelf: the picture is the whole piece, the name sits on a strip under it, and pressing it opens the
// piece's details. A ribbon marks the game's first mint and the newest one.
export function Trophy({
  gameTitle,
  onOpen,
  piece,
}: {
  readonly gameTitle: string;
  readonly onOpen: (piece: ShelfPiece) => void;
  readonly piece: ShelfPiece;
}) {
  return (
    <li className="trophy">
      <button
        aria-label={mintedCopy.viewPiece(piece.title, gameTitle)}
        className="trophy__button"
        onClick={() => onOpen(piece)}
        type="button"
      >
        <span className="trophy__art">
          <MintedArt claimId={piece.claimId} name={piece.title} />
          {piece.ribbon === null ? null : (
            <span className="trophy__ribbon" data-ribbon={piece.ribbon}>
              {mintedCopy.ribbon[piece.ribbon]}
            </span>
          )}
        </span>
        <span className="trophy__strip">
          <strong>{piece.title}</strong>
          <small>{mintedCopy.minted(piece.mintedDay)}</small>
        </span>
      </button>
    </li>
  );
}

// A milestone of the game the player has not minted: its outline, so the shelf shows what is left to earn.
export function Silhouette({ title }: { readonly title: string }) {
  return (
    <li className="trophy trophy--missing">
      <span className="trophy__art" aria-hidden="true" />
      <span className="trophy__strip">
        <strong>{title}</strong>
        <small>{mintedCopy.notMinted}</small>
      </span>
    </li>
  );
}
