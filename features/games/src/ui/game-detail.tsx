import { gamesPath } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadeInfoCard,
  ArcadeInfoRow,
  ArcadeStageHead,
  type DockSection,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import type { GameWalletConfig } from "../wallet-config.ts";
import { GamePlayer } from "./game-player.tsx";
import { GamesFrame } from "./games-frame.tsx";
import { MilestoneList } from "./milestone-list.tsx";
import { WalletGamePlayer } from "./wallet-game-player.tsx";

// One game as its manifest declares it, with the game itself as the main thing on the page when the platform
// plays it. Nothing here implies a milestone can be claimed, or that the platform can see what happens inside
// the game.
export function GameDetail({
  game,
  navigation,
  wallet,
}: {
  readonly game: PublicGame;
  readonly navigation: readonly NavigationItem[];
  readonly wallet: GameWalletConfig;
}) {
  const about = (
    <ArcadeInfoCard title="About">
      <p>{game.summary}</p>
      {game.description === "" ? null : <p>{game.description}</p>}
      <p>
        <ArcadeBadge tone="cyan">{game.networkLabel}</ArcadeBadge>
      </p>
      <small>{`Declarations digest: ${game.hash.slice(0, 16)}`}</small>
    </ArcadeInfoCard>
  );
  const asks = (
    <ArcadeInfoCard title="What it asks for">
      {game.capabilities.length === 0 ? (
        <p>This game does not ask the platform for anything.</p>
      ) : (
        <>
          <ul aria-label="Capabilities the game asks for">
            {game.capabilities.map(({ available, id, label }) => (
              <li key={id}>
                {label}{" "}
                <ArcadeBadge tone={available ? "mint" : "pink"}>
                  {available ? "Available" : "Not available yet"}
                </ArcadeBadge>
              </li>
            ))}
          </ul>
          {game.capabilities.every(({ available }) => available) ? null : (
            <p>
              A request marked not available yet is a declaration only. The
              platform does not grant it.
            </p>
          )}
        </>
      )}
    </ArcadeInfoCard>
  );
  const facts = (
    <>
      <span>{`v${game.version}`}</span>
      <span>{game.networkLabel}</span>
    </>
  );
  const sections: DockSection[] = [
    { badge: null, content: about, id: "about", label: "About" },
    { badge: null, content: asks, id: "asks", label: "What it asks for" },
  ];
  const player = {
    back: (
      <a className="arcade-stage__back" href={gamesPath}>
        ← All games
      </a>
    ),
    game: {
      capabilities: game.capabilities.map(({ id }) => id),
      id: game.id,
      milestones: game.milestones,
    },
    meta: facts,
    sections,
    title: game.title,
  };
  const wantsWallet = game.capabilities.some(
    ({ available, id }) => available && id === "wallet",
  );
  return (
    <GamesFrame navigation={navigation} variant="stage">
      {game.embedSrc === null ? null : wantsWallet ? (
        <WalletGamePlayer
          {...player}
          connectHref={wallet.connectHref}
          network={wallet.network}
          src={game.embedSrc}
        />
      ) : (
        <GamePlayer {...player} src={game.embedSrc} />
      )}
      {game.embedSrc !== null ? null : (
        <>
          <ArcadeStageHead
            meta={
              <>
                {facts}
                <StatusLamp label="Not playable yet" tone="attention" />
              </>
            }
            title={game.title}
          />
          <ArcadeInfoRow>
            <ArcadeInfoCard title="Where to play">
              {game.playUrl === null ? (
                <p>
                  This game is registered, but it has no play address yet, so it
                  cannot be opened from here.
                </p>
              ) : (
                <>
                  <ArcadeButton href={game.playUrl} tone="mint">
                    {`Play ${game.title}`}
                  </ArcadeButton>
                  <p>{`It opens at ${new URL(game.playUrl).host}, not on this site.`}</p>
                </>
              )}
            </ArcadeInfoCard>
            {about}
            {asks}
            {game.milestones.length === 0 ? null : (
              <ArcadeInfoCard title="Milestones">
                <MilestoneList milestones={game.milestones} unlocked={null} />
                <p>
                  These are declared by the game. Earning and claiming them on
                  chain is not available yet, and the platform cannot verify
                  what happens inside a game.
                </p>
              </ArcadeInfoCard>
            )}
          </ArcadeInfoRow>
          <ArcadeButton href={gamesPath} tone="cyan">
            All games
          </ArcadeButton>
        </>
      )}
    </GamesFrame>
  );
}
