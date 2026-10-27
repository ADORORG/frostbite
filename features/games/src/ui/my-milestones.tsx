"use client";

import { signInHref } from "@ador/shared/auth/sign-in-path";
import { gameHref, myMilestonesPath } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeButton,
  ArcadeEmptyState,
  CoverGrid,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { mintedCopy } from "../domain/minted-copy.ts";
import { mintedPlaceholderCount, mintedRows } from "../domain/minted-view.ts";
import type { MintedApi } from "../client/minted-api.ts";
import { GamesFrame } from "./games-frame.tsx";
import { MintedCard } from "./minted-card.tsx";
import { useMinted } from "./use-minted.ts";

const waiting = Array.from({ length: mintedPlaceholderCount }, (_, at) => at);

// The milestones the signed-in player has minted, across games, newest first, as a wall of collectibles: the picture first, then
// which milestone, which game and the day. The wall holds its places while it loads, so nothing moves when the answer lands.
export function MyMilestones({
  api,
  games,
  navigation,
}: {
  readonly api?: MintedApi;
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
}) {
  const state = useMinted(api);
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
        <CoverGrid label={mintedCopy.title}>
          {mintedRows(state.minted, games, gameHref).map((row) => (
            <MintedCard api={api} key={row.claimId} row={row} />
          ))}
        </CoverGrid>
      )}
    </GamesFrame>
  );
}
