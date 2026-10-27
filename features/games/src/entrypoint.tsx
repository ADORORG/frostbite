import { registerHttpOperation } from "@ador/http/registered-operation";
import type { FeatureEntrypoint } from "@ador/plugin-kit";
import type { ChainOption } from "@ador/shared/chain";
import {
  gamePagePath,
  gamesPath,
  myMilestonesPath,
  type GameManifest,
} from "@ador/shared/games";

import {
  createListGameClaimsOperation,
  createRefreshGameClaimOperation,
  createStartGameClaimOperation,
  createSubmitGameClaimOperation,
} from "./application/claims-operations.ts";
import {
  createGetMintedPictureOperation,
  createListMintedMilestonesOperation,
} from "./application/minted-operation.ts";
import {
  createStartGameRunOperation,
  createSubmitGameRunOperation,
} from "./application/runs-operations.ts";
import { createSyncGameStateOperation } from "./application/sync-operation.ts";
import { createGameCatalog } from "./domain/catalog.ts";
import type { GameClaimsConfig } from "./claims-config.ts";
import { createGameClaimsResolver } from "./claims-runtime.ts";
import type { GameRunsConfig } from "./runs-config.ts";
import { createGameRunsResolver } from "./runs-runtime.ts";
import { createGameSyncResolver } from "./runtime.ts";
import { GameDetail } from "./ui/game-detail.tsx";
import { GamesIndex } from "./ui/games-index.tsx";
import { MyMilestones } from "./ui/my-milestones.tsx";
import type { GameWalletConfig } from "./wallet-config.ts";
import { GameNotFound, NoGames } from "./ui/states.tsx";

export function createGamesEntrypoint(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
  wallet: GameWalletConfig,
  runs: GameRunsConfig,
  claims: GameClaimsConfig,
): FeatureEntrypoint {
  const catalog = createGameCatalog(games, chains);
  const runsService = createGameRunsResolver(games, runs);
  const claimsService = createGameClaimsResolver(games, claims);
  const access = { kind: "public" } as const;
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "public-page",
    ],
    id: "games",
    operations: [
      registerHttpOperation(
        createSyncGameStateOperation(createGameSyncResolver(games)),
      ),
      registerHttpOperation(createStartGameRunOperation(runsService)),
      registerHttpOperation(createSubmitGameRunOperation(runsService)),
      registerHttpOperation(createStartGameClaimOperation(claimsService)),
      registerHttpOperation(createSubmitGameClaimOperation(claimsService)),
      registerHttpOperation(createRefreshGameClaimOperation(claimsService)),
      registerHttpOperation(createListGameClaimsOperation(claimsService)),
      registerHttpOperation(createListMintedMilestonesOperation(claimsService)),
      registerHttpOperation(createGetMintedPictureOperation(claimsService)),
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
        access: { kind: "authenticated" },
        path: myMilestonesPath,
        render: ({ navigation }) => (
          <MyMilestones
            explorerTxUrl={wallet.explorerTxUrl}
            games={catalog.list()}
            navigation={navigation}
          />
        ),
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
