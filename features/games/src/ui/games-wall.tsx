import { gameHref, type GameHeat } from "@frostbite/shared/games";
import { ArcadeBadge, CoverCard, CoverGrid } from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { heatById } from "../domain/heat-order.ts";
import { GameCover } from "./game-cover.tsx";
import { heatProps } from "./heat-badges.tsx";

const milestoneCount = (count: number) =>
  `${String(count)} ${count === 1 ? "milestone" : "milestones"}`;

// The games as a wall of covers. When the wall is the whole catalog the first one is larger and each cover carries its place; a
// narrowed wall is a list of answers, where one is not "first" and a number would claim an order that is not there.
export function GamesWall({
  games,
  hot = [],
  whole,
}: {
  readonly games: readonly PublicGame[];
  // The ranked games. Where there are some, a place is a game's rank in them, and a game outside them has none; where there are none, a
  // place is its position in the list.
  readonly hot?: readonly GameHeat[];
  readonly whole: boolean;
}) {
  const heats = heatById(hot);
  return (
    <CoverGrid label="Games">
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
          featured={whole && index === 0}
          {...heatProps(heats.get(game.id))}
          href={gameHref(game.id)}
          key={game.id}
          label={`View ${game.title}`}
          media={<GameCover game={game} />}
          rank={
            whole
              ? hot.length === 0
                ? index + 1
                : heats.get(game.id)?.rank
              : undefined
          }
          summary={game.summary}
          title={game.title}
        />
      ))}
    </CoverGrid>
  );
}
