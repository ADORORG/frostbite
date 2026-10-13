import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ChainOption } from "@ador/shared/chain";
import { gamePagePath, gamesPath, type GameManifest } from "@ador/shared/games";

import { createSyncGameStateOperation } from "./application/sync-operation.ts";
import { createGameCatalog } from "./domain/catalog.ts";
import { createGameSyncResolver } from "./runtime.ts";
import { GameDetail } from "./ui/game-detail.tsx";
import { GamesIndex } from "./ui/games-index.tsx";
import type { GameWalletConfig } from "./wallet-config.ts";
import { GameNotFound, NoGames } from "./ui/states.tsx";

export function createGamesEntrypoint(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
  wallet: GameWalletConfig,
): FeatureEntrypoint {
  const catalog = createGameCatalog(games, chains);
  const access = { kind: "public" } as const;
  return {
    capabilities: ["api-routes", "navigation", "public-page"],
    id: "games",
    operations: [
      registerHttpOperation(
        createSyncGameStateOperation(createGameSyncResolver(games)),
      ),
    ],
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
            return (
              <GameDetail game={game} navigation={navigation} wallet={wallet} />
            );
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
