"use client";

import { signInHref } from "@frostbite/shared/auth/sign-in-path";
import { gameHref, myMilestonesPath } from "@frostbite/shared/games";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { ExplorerBoundary } from "@frostbite/feature-chain-status/transaction";
import { ArcadeButton, ArcadeEmptyState, StatusLamp } from "@repo/ui/arcade";
import type { ShareConfig } from "@frostbite/share";
import type { CreateShareInput } from "@frostbite/shared/games";
import { useState } from "react";

import type { PublicGame } from "../domain/catalog.ts";
import { mintedCopy } from "../domain/minted-copy.ts";
import { shareCopy } from "../domain/share-copy.ts";
import { mintedPlaceholderCount } from "../domain/minted-view.ts";
import {
  shelfStats,
  shelves,
  type Shelf,
  type ShelfPiece,
} from "../domain/shelf-view.ts";
import type { MintedApi } from "../client/minted-api.ts";
import type { SharesApi } from "../client/shares-api.ts";
import { GamesFrame } from "./games-frame.tsx";
import { Album } from "./album.tsx";
import { ShelfSummary } from "./shelf-summary.tsx";
import { TrophyDialog } from "./trophy-dialog.tsx";
import { ShareControl } from "./share-control.tsx";
import { useMinted } from "./use-minted.ts";

// Sharing the shelf names nothing but the shelf: the link's page shows the title and a way to play.
const shelfRequest: CreateShareInput = { kind: "milestones" };
const waiting = Array.from({ length: mintedPlaceholderCount }, (_, at) => at);

// The signed-in player's milestones as a trophy case: a shelf for each game with a place for every milestone, the minted ones as
// pictures and the rest as outlines. The case holds its places while it loads, so nothing moves when the answer lands.
export function MyMilestones({
  api,
  explorerTxUrl,
  games,
  navigation,
  share,
  sharesApi,
}: {
  readonly api?: MintedApi;
  // Where a transaction is shown on a block explorer (`{id}` where its id goes).
  readonly explorerTxUrl: string;
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
  // Where a link can be shared; without it nothing here can be.
  readonly share?: ShareConfig;
  readonly sharesApi?: SharesApi;
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
        {state.kind === "ready" && state.minted.length > 0 ? (
          <ShareControl
            api={sharesApi}
            config={share}
            heading={mintedCopy.title}
            kicker={shareCopy.collectionKicker}
            request={shelfRequest}
            text={shareCopy.post.collection}
          />
        ) : null}
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
          <Album
            all={shelves(state.minted, games, gameHref)}
            onOpen={(piece, shelf) => setOpen({ piece, shelf })}
          />
          <TrophyDialog
            onClose={() => setOpen(null)}
            open={open}
            share={share}
            sharesApi={sharesApi}
          />
        </ExplorerBoundary>
      )}
    </GamesFrame>
  );
}
