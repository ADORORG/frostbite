"use client";

import { signInHref } from "@ador/shared/auth/sign-in-path";
import { gameHref, myMilestonesPath } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import { ExplorerBoundary } from "@ador/feature-chain-status/transaction";
import { ArcadeButton, ArcadeEmptyState, StatusLamp } from "@repo/ui/arcade";
import { useState } from "react";

import type { PublicGame } from "../domain/catalog.ts";
import { mintedCopy } from "../domain/minted-copy.ts";
import { mintedPlaceholderCount } from "../domain/minted-view.ts";
import {
  shelfStats,
  shelves,
  type Shelf,
  type ShelfPiece,
} from "../domain/shelf-view.ts";
import type { MintedApi } from "../client/minted-api.ts";
import { GamesFrame } from "./games-frame.tsx";
import { GameShelf } from "./game-shelf.tsx";
import { ShelfSummary } from "./shelf-summary.tsx";
import { TrophyDialog } from "./trophy-dialog.tsx";
import { useMinted } from "./use-minted.ts";

const waiting = Array.from({ length: mintedPlaceholderCount }, (_, at) => at);

// The signed-in player's milestones as a trophy case: a shelf for each game with a place for every milestone, the minted ones as
// pictures and the rest as outlines. The case holds its places while it loads, so nothing moves when the answer lands.
export function MyMilestones({
  api,
  explorerTxUrl,
  games,
  navigation,
}: {
  readonly api?: MintedApi;
  // Where a transaction is shown on a block explorer (`{id}` where its id goes).
  readonly explorerTxUrl: string;
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
}) {
  const state = useMinted(api);
  const [open, setOpen] = useState<{
    readonly piece: ShelfPiece;
    readonly shelf: Shelf;
  } | null>(null);
  return (
    <GamesFrame navigation={navigation} variant="wall">
      <header className="arcade-wall-head">
        <h2>
          {mintedCopy.title}
          {state.kind === "ready" ? <span>{state.minted.length}</span> : null}
        </h2>
        <p>{mintedCopy.intro}</p>
      </header>
      {state.kind === "loading" ? (
        <>
          <StatusLamp label={mintedCopy.loading} tone="attention" />
          <ul aria-hidden="true" className="cover-grid">
            {waiting.map((at) => (
              <li className="cover-card minted-waiting" key={at} />
            ))}
          </ul>
        </>
      ) : state.kind === "failed" ? (
        <p role="alert">{mintedCopy.failed}</p>
      ) : state.kind === "signed-out" ? (
        <ArcadeButton href={signInHref(myMilestonesPath)} tone="cyan">
          {mintedCopy.signedOut}
        </ArcadeButton>
      ) : state.minted.length === 0 ? (
        <ArcadeEmptyState title={mintedCopy.title}>
          {mintedCopy.empty}
        </ArcadeEmptyState>
      ) : (
        <ExplorerBoundary txUrl={explorerTxUrl}>
          <ShelfSummary stats={shelfStats(state.minted, games)} />
          {shelves(state.minted, games, gameHref).map((shelf) => (
            <GameShelf
              key={shelf.gameId}
              onOpen={(piece) => setOpen({ piece, shelf })}
              shelf={shelf}
            />
          ))}
          <TrophyDialog onClose={() => setOpen(null)} open={open} />
        </ExplorerBoundary>
      )}
    </GamesFrame>
  );
}
