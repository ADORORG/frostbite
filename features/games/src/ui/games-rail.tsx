import { SceneBackdrop } from "@frostbite/scenes/react";
import { gameHref, gamesPath } from "@frostbite/shared/games";
import {
  ArcadeBadge,
  ArcadeEmptyState,
  CoverCard,
  CoverGrid,
  HomeRail,
  homeRailLimit,
} from "@repo/ui/arcade";

import type { PublicGame } from "../domain/catalog.ts";
import { homeRailCopy } from "../domain/home-rail-copy.ts";
import { GameCover } from "./game-cover.tsx";
import { noGames } from "./states.tsx";

// The landing page's rail of games: the first few, playable ones first, each with its picture alive, and a link to the whole list. A lone game
// (what a deployment players use has) is drawn large, across the band, so the page is not a card in a corner. With no games it says so, in
// the catalog's own words.
export function GamesRail({
  games,
}: {
  readonly games: readonly PublicGame[];
}) {
  const shown = [...games]
    .sort((a, b) => Number(b.playable) - Number(a.playable))
    .slice(0, homeRailLimit);
  return (
    <HomeRail
      backdrop={<SceneBackdrop />}
      href={gamesPath}
      id="games"
      linkLabel={homeRailCopy.link(games.length)}
      summary={homeRailCopy.summary}
      title={homeRailCopy.title}
    >
      {shown.length === 0 ? (
        <ArcadeEmptyState title={noGames.title}>
          {noGames.body}
        </ArcadeEmptyState>
      ) : (
        <CoverGrid label={homeRailCopy.title}>
          {shown.map((game) => (
            <CoverCard
              featured={shown.length === 1}
              badges={
                <ArcadeBadge tone={game.playable ? "mint" : "pink"}>
                  {game.playable ? "Playable" : "Not playable yet"}
                </ArcadeBadge>
              }
              cta={game.playable ? "▶ Play now" : "View game"}
              href={gameHref(game.id)}
              key={game.id}
              label={`View ${game.title}`}
              media={<GameCover game={game} />}
              summary={game.summary}
              title={game.title}
            />
          ))}
        </CoverGrid>
      )}
    </HomeRail>
  );
}
