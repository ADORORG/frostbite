import { gameHref } from "@ador/shared/games";
import type { NavigationItem } from "@ador/plugin-kit/navigation";
import {
  ArcadeBadge,
  ArcadePreview,
  ArcadeTicker,
  CoverCard,
  CoverGrid,
  StatusLamp,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { GamesFrame } from "./games-frame.tsx";

const milestoneCount = (count: number) =>
  `${String(count)} ${count === 1 ? "milestone" : "milestones"}`;

// The registered games as a wall of covers, the first one larger, each picture alive (a clip plays while it is on screen). A game
// with no play address says it cannot be played yet, and one with no picture gets a stand-in drawn from its name.
export function GamesIndex({
  games,
  navigation,
}: {
  readonly games: readonly PublicGame[];
  readonly navigation: readonly NavigationItem[];
}) {
  const playable = games.filter((game) => game.playable).length;
  return (
    <GamesFrame navigation={navigation} variant="wall">
      <ArcadeTicker
        items={["Insert coin", ...games.map(({ title }) => title)]}
      />
      <header className="arcade-wall-head">
        <StatusLamp label="Registered games" tone="ready" />
        <h2>Games</h2>
        <p>
          {`${String(games.length)} registered, ${String(playable)} you can play now. A game is playable only when it has a play address.`}
        </p>
      </header>
      <CoverGrid label="Registered games">
        {games.map((game, index) => (
          <CoverCard
            badges={
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
            cta={game.playable ? "▶ Play now" : "View game"}
            featured={index === 0}
            href={gameHref(game.id)}
            key={game.id}
            label={`View ${game.title}`}
            rank={index + 1}
            media={
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
      </CoverGrid>
    </GamesFrame>
  );
}
