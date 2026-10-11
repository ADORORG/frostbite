import { gamesPath } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadePanel,
  StatusLamp,
} from "@repo/ui/arcade";

import {
  gameMilestonePolicyLabels,
  type PublicGame,
} from "../domain/catalog.ts";
import { GamePlayer } from "./game-player.tsx";
import { GamesFrame } from "./games-frame.tsx";

// One game as its manifest declares it. Nothing here implies a milestone can be claimed, or that the
// platform can see what happens inside the game.
export function GameDetail({
  game,
  navigation,
}: {
  readonly game: PublicGame;
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation}>
      <StatusLamp
        label={game.playable ? "Playable" : "Not playable yet"}
        tone={game.playable ? "ready" : "attention"}
      />
      <ArcadePanel eyebrow={`Version ${game.version}`} title={game.title}>
        <p>{game.summary}</p>
        {game.description === "" ? null : <p>{game.description}</p>}
        <p>
          <ArcadeBadge tone="cyan">{game.networkLabel}</ArcadeBadge>
        </p>
        {game.embedSrc !== null ? (
          <p>This game is played on this page.</p>
        ) : game.playUrl === null ? (
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
      </ArcadePanel>
      {game.embedSrc === null ? null : (
        <GamePlayer
          game={{ id: game.id, milestones: game.milestones }}
          src={game.embedSrc}
          title={game.title}
        />
      )}
      <ArcadePanel eyebrow="Declared by the game" title="What it asks for">
        {game.capabilities.length === 0 ? (
          <p>This game does not ask the platform for anything.</p>
        ) : (
          <>
            <ul aria-label="Capabilities the game asks for">
              {game.capabilities.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <p>
              These are requests only. The platform does not grant them yet.
            </p>
          </>
        )}
      </ArcadePanel>
      {game.milestones.length === 0 ? null : (
        <ArcadePanel eyebrow="Declared by the game" title="Milestones">
          <ul aria-label="Milestones of this game">
            {game.milestones.map((milestone) => (
              <li key={milestone.id}>
                <strong>{milestone.title}</strong>
                <p>{milestone.description}</p>
                <p>{`How it is earned: ${milestone.criteria}`}</p>
                <ArcadeBadge tone="yellow">
                  {gameMilestonePolicyLabels[milestone.claimPolicy]}
                </ArcadeBadge>
              </li>
            ))}
          </ul>
          <p>
            These are declared by the game. Earning and claiming them on chain
            is not available yet, and the platform cannot verify what happens
            inside a game.
          </p>
        </ArcadePanel>
      )}
      <p>{`Declarations digest: ${game.hash.slice(0, 16)}`}</p>
      <ArcadeButton href={gamesPath} tone="cyan">
        All games
      </ArcadeButton>
    </GamesFrame>
  );
}
