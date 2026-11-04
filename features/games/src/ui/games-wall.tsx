import { gameHref } from "@ador/shared/games";
import { ArcadeBadge, CoverCard, CoverGrid } from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { GameCover } from "./game-cover.tsx";

const milestoneCount = (count: number) =>
  `${String(count)} ${count === 1 ? "milestone" : "milestones"}`;

// The games as a wall of covers. When the wall is the whole catalog the first one is larger and each cover carries its place; a
// narrowed wall is a list of answers, where one is not "first" and a number would claim an order that is not there.
export function GamesWall({
  games,
  whole,
}: {
  readonly games: readonly PublicGame[];
  readonly whole: boolean;
}) {
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
          href={gameHref(game.id)}
          key={game.id}
          label={`View ${game.title}`}
          media={<GameCover game={game} />}
          rank={whole ? index + 1 : undefined}
          summary={game.summary}
          title={game.title}
        />
      ))}
    </CoverGrid>
  );
}
