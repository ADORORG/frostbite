"use client";

import { useState } from "react";

import { mintedCopy } from "../domain/minted-copy.ts";
import {
  latestPieces,
  type Shelf,
  type ShelfPiece,
} from "../domain/shelf-view.ts";
import { GameRail } from "./game-rail.tsx";
import { GameShelf } from "./game-shelf.tsx";
import { LatestRow } from "./latest-row.tsx";

// How many of the newest mints lead the page.
const latestCount = 6;

// The player's collection at any size: the newest mints first, a row of cartridges to pick a game from, and only the picked game's shelf
// below. The page is the same height for three games and for forty. It opens on the game with the newest mint.
export function Album({
  all,
  onOpen,
}: {
  readonly all: readonly Shelf[];
  readonly onOpen: (piece: ShelfPiece, shelf: Shelf) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const current = all.find(({ gameId }) => gameId === picked) ?? all[0];
  // With mints in one game alone, its shelf already is the latest; a second row would only repeat it.
  const withMints = all.filter(({ pieces }) => pieces.length > 0).length;
  const latest = withMints > 1 ? latestPieces(all, latestCount) : [];
  return (
    <>
      {latest.length === 0 ? null : (
        <LatestRow items={latest} onOpen={onOpen} />
      )}
      {all.length <= 1 ? null : (
        <>
          <h3 className="album__heading">{mintedCopy.byGame}</h3>
          <GameRail
            all={all}
            onSelect={setPicked}
            selected={current?.gameId ?? ""}
          />
        </>
      )}
      {current === undefined ? null : (
        <GameShelf key={current.gameId} onOpen={onOpen} shelf={current} />
      )}
    </>
  );
}
