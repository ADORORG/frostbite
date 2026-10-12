import { gameHref } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadeButton,
  ArcadeCatalog,
  ArcadeCatalogEntry,
  ArcadePreview,
  ArcadeTicker,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { GamesFrame } from "./games-frame.tsx";

const milestoneCount = (count: number) =>
  `${String(count)} ${count === 1 ? "milestone" : "milestones"}`;

// The registered games as a wall of previews. A game with no play address says it cannot be played yet.
export function GamesIndex({
  games,
  navigation,
}: {
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
}) {
  return (
    <GamesFrame navigation={navigation} variant="wall">
      <ArcadeTicker
        items={["Insert coin", ...games.map(({ title }) => title)]}
      />
      <header className="arcade-wall-head">
        <StatusLamp label="Registered games" tone="ready" />
        <p className="arcade-eyebrow">Public catalog</p>
        <h2>Games</h2>
        <p>
          Games that are registered with the platform. A game is playable only
          when it has a play address.
        </p>
      </header>
      <ArcadeCatalog label="Registered games">
        {games.map((game, index) => (
          <ArcadeCatalogEntry
            actions={
              <ArcadeButton
                ariaLabel={`View ${game.title}`}
                href={gameHref(game.id)}
                tone={game.playable ? "mint" : "cyan"}
              >
                {game.playable ? "Play now" : "View game"}
              </ArcadeButton>
            }
            facts={
              <>
                <ArcadeBadge tone={game.playable ? "mint" : "pink"}>
                  {game.playable ? "Playable" : "Not playable yet"}
                </ArcadeBadge>
                <ArcadeBadge tone="cyan">{game.networkLabel}</ArcadeBadge>
                {game.milestones.length === 0 ? null : (
                  <ArcadeBadge tone="yellow">
                    {milestoneCount(game.milestones.length)}
                  </ArcadeBadge>
                )}
              </>
            }
            href={gameHref(game.id)}
            key={game.id}
            position={index + 1}
            preview={
              <ArcadePreview
                alt={game.cover?.alt ?? ""}
                image={game.cover?.image ?? null}
                name={game.title}
                video={game.cover?.video ?? null}
              />
            }
            summary={game.summary}
            title={game.title}
          />
        ))}
      </ArcadeCatalog>
    </GamesFrame>
  );
}
