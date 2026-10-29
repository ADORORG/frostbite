"use client";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { ShelfPiece } from "../domain/shelf-view.ts";
import { MintedArt } from "./minted-art.tsx";

// One minted milestone on a shelf: the picture (or its medallion) is the whole piece, the name and day sit on a strip over its foot, and
// pressing it opens the piece's details. A ribbon marks the game's first mint and the newest one.
export function Trophy({
  cover,
  gameTitle,
  onOpen,
  piece,
}: {
  readonly cover: string | null;
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
          <MintedArt claimId={piece.claimId} cover={cover} name={piece.title} />
          {piece.ribbon === null ? null : (
            <span className="trophy__ribbon" data-ribbon={piece.ribbon}>
              {mintedCopy.ribbon[piece.ribbon]}
            </span>
          )}
          <span className="trophy__strip">
            <strong>{piece.title}</strong>
            <small>{mintedCopy.minted(piece.mintedDay)}</small>
          </span>
        </span>
      </button>
    </li>
  );
}
