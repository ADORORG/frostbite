import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ChainOption } from "@ador/shared/chain";
import { gamePagePath, gamesPath, type GameManifest } from "@ador/shared/games";

import { createGameCatalog } from "./domain/catalog.ts";
import { GameDetail } from "./ui/game-detail.tsx";
import { GamesIndex } from "./ui/games-index.tsx";
import { GameNotFound, NoGames } from "./ui/states.tsx";

export function createGamesEntrypoint(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
): FeatureEntrypoint {
  const catalog = createGameCatalog(games, chains);
  const access = { kind: "public" } as const;
  return {
    capabilities: ["navigation", "public-page"],
    id: "games",
    pages: [
      {
        access,
        path: gamesPath,
        render: ({ navigation }) => {
          const list = catalog.list();
          return list.length === 0 ? (
            <NoGames navigation={navigation} />
          ) : (
            <GamesIndex games={list} navigation={navigation} />
          );
        },
      },
      {
        access,
        path: gamePagePath,
        render: ({ navigation, params }) => {
          const game = catalog.find(params.slug);
          if (game !== null)
            return <GameDetail game={game} navigation={navigation} />;
          return (
            <GameNotFound
              navigation={navigation}
              slug={
                catalog.isValidSlug(params.slug) ? (params.slug ?? null) : null
              }
            />
          );
        },
      },
    ],
    version: "1.0.0",
  };
}
