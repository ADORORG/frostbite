"use client";

import { ArcadePreview } from "@repo/ui/arcade";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { Shelf, ShelfPiece } from "../domain/shelf-view.ts";
import { Trophy } from "./trophy.tsx";

// One game's shelf: its cover and name, one segment of progress for each of its milestones, the pieces minted, and what is still to
// earn kept small and out of the way (open when nothing has been minted yet, so a new player sees what the game offers).
export function GameShelf({
  onOpen,
  shelf,
}: {
  readonly onOpen: (piece: ShelfPiece, shelf: Shelf) => void;
  readonly shelf: Shelf;
}) {
  const cover = shelf.cover?.image ?? null;
  return (
    <section
      aria-label={mintedCopy.shelfTitle(shelf.gameTitle)}
      className="shelf"
    >
      <header className="shelf__head">
        <span className="shelf__cover">
          <ArcadePreview
            alt=""
            image={cover}
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
        <span
          aria-hidden="true"
          className="shelf__segments"
          style={{ gridTemplateColumns: `repeat(${String(shelf.total)}, 1fr)` }}
        >
          {Array.from({ length: shelf.total }, (_, at) => (
            <span data-on={at < shelf.earned} key={at} />
          ))}
        </span>
      </header>
      {shelf.pieces.length === 0 ? null : (
        <ul className="shelf__row">
          {shelf.pieces.map((piece) => (
            <Trophy
              cover={cover}
              gameTitle={shelf.gameTitle}
              key={piece.claimId}
              onOpen={(opened) => onOpen(opened, shelf)}
              piece={piece}
            />
          ))}
        </ul>
      )}
      {shelf.missing.length === 0 ? null : (
        <details className="shelf__locked" open={shelf.pieces.length === 0}>
          <summary>{mintedCopy.stillToEarn(shelf.missing.length)}</summary>
          <ul>
            {shelf.missing.map(({ milestoneId, title }) => (
              <li key={milestoneId}>{title}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
