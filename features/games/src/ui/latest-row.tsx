"use client";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { Shelf, ShelfPiece } from "../domain/shelf-view.ts";
import { Trophy } from "./trophy.tsx";

// The newest mints across every game, big, at the top of the page: however many games there are, the page opens on what just happened.
export function LatestRow({
  items,
  onOpen,
}: {
  readonly items: readonly {
    readonly piece: ShelfPiece;
    readonly shelf: Shelf;
  }[];
  readonly onOpen: (piece: ShelfPiece, shelf: Shelf) => void;
}) {
  return (
    <section aria-label={mintedCopy.latestRow} className="latest">
      <h3 className="latest__title">{mintedCopy.latestRow}</h3>
      <ul className="shelf__row shelf__row--latest">
        {items.map(({ piece, shelf }) => (
          <Trophy
            cover={shelf.cover?.image ?? null}
            gameTitle={shelf.gameTitle}
            key={piece.claimId}
            onOpen={(opened) => onOpen(opened, shelf)}
            piece={piece}
          />
        ))}
      </ul>
    </section>
  );
}
