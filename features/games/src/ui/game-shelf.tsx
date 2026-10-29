"use client";

import { ArcadePreview, ArcadeProgress } from "@repo/ui/arcade";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { Shelf, ShelfPiece } from "../domain/shelf-view.ts";
import { Silhouette, Trophy } from "./trophy.tsx";

// One game's shelf: its cover and name, how many of its milestones are minted, and a place for every one of them.
export function GameShelf({
  onOpen,
  shelf,
}: {
  readonly onOpen: (piece: ShelfPiece, shelf: Shelf) => void;
  readonly shelf: Shelf;
}) {
  return (
    <section
      aria-label={mintedCopy.shelfTitle(shelf.gameTitle)}
      className="shelf"
    >
      <header className="shelf__head">
        <span className="shelf__cover">
          <ArcadePreview
            alt=""
            image={shelf.cover?.image ?? null}
            name={shelf.gameTitle}
            video={null}
          />
        </span>
        <div>
          <h3>
            <a href={shelf.gameHref}>{shelf.gameTitle}</a>
          </h3>
          <p>{mintedCopy.mintedProgress(shelf.earned, shelf.total)}</p>
        </div>
        <ArcadeProgress
          label={mintedCopy.progressLabel(shelf.gameTitle)}
          // A shelf has at least one place, so the total is never zero.
          value={shelf.earned / shelf.total}
        />
      </header>
      <ul className="shelf__row">
        {shelf.slots.map((slot) =>
          slot.kind === "minted" ? (
            <Trophy
              gameTitle={shelf.gameTitle}
              key={slot.piece.claimId}
              onOpen={(piece) => onOpen(piece, shelf)}
              piece={slot.piece}
            />
          ) : (
            <Silhouette key={slot.milestoneId} title={slot.title} />
          ),
        )}
      </ul>
    </section>
  );
}
