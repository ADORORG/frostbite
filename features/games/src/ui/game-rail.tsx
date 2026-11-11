"use client";

import { ArcadePreview } from "@repo/ui/arcade";
import { useState } from "react";

import { mintedCopy } from "../domain/minted-copy.ts";
import type { Shelf } from "../domain/shelf-view.ts";

// The games as small cartridges in one row that scrolls sideways, so choosing among forty takes no more room than choosing among three. A
// game with a mint is a lit cartridge; a game with nothing minted yet is kept behind a toggle, so the row is the player's own games first.
export function GameRail({
  all,
  onSelect,
  selected,
}: {
  readonly all: readonly Shelf[];
  readonly onSelect: (gameId: string) => void;
  readonly selected: string;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const mine = all.filter(({ pieces }) => pieces.length > 0);
  const empty = all.filter(({ pieces }) => pieces.length === 0);
  const shown =
    showEmpty ||
    all.find(({ gameId }) => gameId === selected)?.pieces.length === 0
      ? [...mine, ...empty]
      : mine;
  return (
    <div className="rail-games">
      <ul aria-label={mintedCopy.railLabel} className="rail-games__row">
        {shown.map((shelf) => (
          <li key={shelf.gameId}>
            <button
              aria-label={mintedCopy.railTile(
                shelf.gameTitle,
                shelf.earned,
                shelf.total,
              )}
              aria-pressed={shelf.gameId === selected}
              className="rail-game"
              data-empty={shelf.pieces.length === 0 ? "true" : undefined}
              onClick={() => onSelect(shelf.gameId)}
              type="button"
            >
              <span className="rail-game__cover">
                <ArcadePreview
                  alt=""
                  image={shelf.cover?.image ?? null}
                  name={shelf.gameTitle}
                  video={null}
                />
              </span>
              <strong>{shelf.gameTitle}</strong>
              <small>
                {shelf.earned}/{shelf.total}
              </small>
            </button>
          </li>
        ))}
      </ul>
      {empty.length === 0 ? null : (
        <button
          className="rail-games__toggle"
          onClick={() => setShowEmpty(!showEmpty)}
          type="button"
        >
          {showEmpty
            ? mintedCopy.hideEmptyGames
            : mintedCopy.emptyGames(empty.length)}
        </button>
      )}
    </div>
  );
}
