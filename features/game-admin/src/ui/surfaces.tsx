import { ExplorerBoundary } from "@frostbite/feature-chain-status/transaction";
import type { NavigationItem } from "@frostbite/plugin-kit/navigation";
import { gameAdminHref } from "@frostbite/shared/games";
import {
  ArcadeBadge,
  ArcadeEmptyState,
  SectionBlock,
  Tile,
  shortenMiddle,
} from "@repo/ui/arcade";

import type { GameAdminApi } from "../client/api.ts";
import type { AdminGameInfo } from "../game-info.ts";
import { AdminFrame } from "./admin-frame.tsx";
import { FeeSettingsBoundary, type FeeSettings } from "./fee-settings.tsx";
import { MintFigures, MintFiguresBoundary } from "./mint-figures.tsx";
import { MintsSection } from "./mints-section.tsx";
import { PlatformFeePanel } from "./platform-fee-panel.tsx";
import { WalletGamePanel, WalletTemplatesPanel } from "./wallet-panels.tsx";

type Navigation = readonly NavigationItem[];

// The staff page listing the games that declare rewards, and whether each has a contract to administer.
export function GamesSurface({
  api,
  explorerTxUrl,
  fees,
  games,
  navigation,
  signingWallets,
}: {
  readonly api?: GameAdminApi;
  readonly explorerTxUrl: string;
  readonly fees: FeeSettings;
  readonly games: readonly AdminGameInfo[];
  readonly navigation: Navigation;
  readonly signingWallets: readonly string[];
}) {
  return (
    <AdminFrame
      heading="Game rewards"
      intro="Games whose milestones can be claimed on chain. Publishing a template, creating a game's contract, defining a milestone and pausing claims are steps you sign yourself."
      navigation={navigation}
    >
      <ExplorerBoundary txUrl={explorerTxUrl}>
        <FeeSettingsBoundary settings={fees}>
          <WalletTemplatesPanel
            {...(api === undefined ? {} : { api })}
            signingWallets={signingWallets}
          />
        </FeeSettingsBoundary>
      </ExplorerBoundary>
      <PlatformFeePanel {...(api === undefined ? {} : { api })} />
      <SectionBlock title="Games">
        {games.length === 0 ? (
          <ArcadeEmptyState title="Nothing to administer">
            No game declares rewards yet.
          </ArcadeEmptyState>
        ) : (
          <MintFiguresBoundary {...(api === undefined ? {} : { api })}>
            <ul aria-label="Games with rewards" className="tile-grid">
              {games.map((game) => (
                <li key={game.id}>
                  <Tile
                    badge={
                      <span title={game.chain}>
                        <ArcadeBadge tone="cyan">
                          {shortenMiddle(game.chain, { head: 10, tail: 4 })}
                        </ArcadeBadge>
                      </span>
                    }
                    footer={
                      <a
                        href={gameAdminHref(game.id)}
                      >{`Administer ${game.title}`}</a>
                    }
                    title={game.title}
                  >
                    <p>{`${game.milestones.length} milestone${game.milestones.length === 1 ? "" : "s"}`}</p>
                    <MintFigures gameId={game.id} />
                  </Tile>
                </li>
              ))}
            </ul>
          </MintFiguresBoundary>
        )}
      </SectionBlock>
    </AdminFrame>
  );
}

// One game's administration page. A game that is unknown or declares no rewards is "not found", never an empty form.
export function GameSurface({
  api,
  explorerTxUrl,
  fees,
  game,
  navigation,
  signingWallets,
}: {
  readonly api?: GameAdminApi;
  readonly explorerTxUrl: string;
  readonly fees: FeeSettings;
  readonly game: AdminGameInfo | undefined;
  readonly navigation: Navigation;
  readonly signingWallets: readonly string[];
}) {
  if (game === undefined)
    return (
      <AdminFrame
        heading="Game not found"
        intro="No game with that address declares rewards."
        navigation={navigation}
      >
        <a href="/admin/games">Back to game rewards</a>
      </AdminFrame>
    );
  return (
    <AdminFrame
      heading={game.title}
      intro={`Rewards on ${game.chain}.`}
      navigation={navigation}
    >
      <ExplorerBoundary txUrl={explorerTxUrl}>
        <FeeSettingsBoundary settings={fees}>
          <WalletGamePanel
            {...(api === undefined ? {} : { api })}
            game={game}
            signingWallets={signingWallets}
          >
            <MintsSection
              {...(api === undefined ? {} : { api })}
              gameId={game.id}
            />
          </WalletGamePanel>
        </FeeSettingsBoundary>
      </ExplorerBoundary>
    </AdminFrame>
  );
}
