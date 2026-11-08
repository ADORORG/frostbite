"use client";

import { ArcadePreview } from "@repo/ui/arcade";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { Shelf, ShelfPiece } from "../domain/shelf-view.ts";
import { Trophy } from "./trophy.tsx";

// One game's shelf: its cover and name, one segment of progress for each of its milestones, the pieces minted, and what is still to
// earn kept small and out of the way (open when nothing has been minted yet, so a new player sees what the game offers).
// The most places still to fill that a shelf draws, so a game with many milestones stays one screen; the rest are counted.
const lockedLimit = 5;

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
        {cover === null ? null : (
          <img
            alt=""
            aria-hidden="true"
            className="shelf__banner"
            src={cover}
          />
        )}
        <span className="shelf__cover">
          <ArcadePreview
            alt=""
            image={cover}
            name={shelf.gameTitle}
            video={null}
          />
        </span>
        <div className="shelf__title">
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
        {shelf.missing.slice(0, lockedLimit).map(({ milestoneId, title }) => (
          <li
            aria-label={mintedCopy.lockedSlot(title)}
            className="trophy trophy--missing"
            key={milestoneId}
          >
            <span
              aria-hidden="true"
              className="trophy__art trophy__art--locked"
            >
              <span className="trophy__lock">?</span>
              <span className="trophy__strip">
                <strong>{title}</strong>
              </span>
            </span>
          </li>
        ))}
        {shelf.missing.length <= lockedLimit ? null : (
          <li className="trophy trophy--missing trophy--more">
            <span className="trophy__art trophy__art--locked">
              <strong>
                {mintedCopy.moreToEarn(shelf.missing.length - lockedLimit)}
              </strong>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
