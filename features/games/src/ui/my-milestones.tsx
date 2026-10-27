import { signInHref } from "@ador/shared/auth/sign-in-path";
import { gameHref, myMilestonesPath } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ExplorerBoundary,
  plainTransactionLabel,
  TransactionList,
} from "@ador/feature-chain-status/transaction";
import {
  ArcadeButton,
  ArcadePanel,
  ArcadeStatusCard,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { mintedCopy } from "../domain/minted-copy.ts";
import { mintedRows } from "../domain/minted-view.ts";
import type { MintedApi } from "../client/minted-api.ts";
import { MintedPicture } from "./minted-picture.tsx";
import { GamesFrame } from "./games-frame.tsx";
import { useMinted } from "./use-minted.ts";

// The milestones the signed-in player has minted, across games, newest first: which game and milestone, when, and the transaction on
// the network with a link to see it.
export function MyMilestones({
  api,
  explorerTxUrl,
  games,
  navigation,
}: {
  readonly api?: MintedApi;
  readonly explorerTxUrl: string;
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
}) {
  const state = useMinted(api);
  return (
    <GamesFrame navigation={navigation}>
      <ArcadePanel eyebrow="Your account" title={mintedCopy.title}>
        <p>{mintedCopy.intro}</p>
        {state.kind === "loading" ? (
          <StatusLamp label={mintedCopy.loading} tone="attention" />
        ) : state.kind === "failed" ? (
          <p role="alert">{mintedCopy.failed}</p>
        ) : state.kind === "signed-out" ? (
          <ArcadeButton href={signInHref(myMilestonesPath)} tone="cyan">
            {mintedCopy.signedOut}
          </ArcadeButton>
        ) : state.minted.length === 0 ? (
          <p>{mintedCopy.empty}</p>
        ) : (
          <ExplorerBoundary txUrl={explorerTxUrl}>
            <ul aria-label={mintedCopy.title}>
              {mintedRows(state.minted, games, gameHref).map((row) => (
                <li key={row.claimId}>
                  <ArcadeStatusCard
                    action={
                      <ArcadeButton href={row.gameHref} tone="cyan">
                        {`Open ${row.gameTitle}`}
                      </ArcadeButton>
                    }
                    status={{ label: row.mintedOn, tone: "done" }}
                    title={row.milestoneTitle}
                  >
                    <MintedPicture
                      alt={row.milestoneTitle}
                      api={api}
                      claimId={row.claimId}
                    />
                    <TransactionList
                      transactions={[
                        { id: row.transactionId, label: plainTransactionLabel },
                      ]}
                    />
                  </ArcadeStatusCard>
                </li>
              ))}
            </ul>
          </ExplorerBoundary>
        )}
      </ArcadePanel>
    </GamesFrame>
  );
}
