import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";
import { privatePage } from "@frostbite/plugin-kit/page-metadata";
import type { ChainOption } from "@frostbite/shared/chain";
import { homeSectionOrder } from "@frostbite/shared/platform";
import {
  gamePagePath,
  gamesPath,
  myMilestonesPath,
  type GameManifest,
} from "@frostbite/shared/games";

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
import { parseGameQuery, searchParamsOf } from "./domain/game-query.ts";
import type { GameClaimsConfig } from "./claims-config.ts";
import { createGameClaimsResolver } from "./claims-runtime.ts";
import type { GameRunsConfig } from "./runs-config.ts";
import { createGameRunsResolver } from "./runs-runtime.ts";
import { createGameSyncResolver } from "./runtime.ts";
import {
  gameMetadata,
  gameSitemapPaths,
  gamesIndexMetadata,
} from "./metadata.ts";
import { GameDetail } from "./ui/game-detail.tsx";
import { GamesIndex } from "./ui/games-index.tsx";
import { GamesRail } from "./ui/games-rail.tsx";
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
      "home-section",
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
    homeSections: [
      {
        id: "games",
        order: homeSectionOrder.games,
        render: () => <GamesRail games={catalog.list()} />,
      },
    ],
    pages: [
      {
        access,
        metadata: () =>
          catalog.list().length === 0 ? privatePage : gamesIndexMetadata,
        path: gamesPath,
        render: ({ navigation, searchParams = {} }) => {
          const list = catalog.list();
          return list.length === 0 ? (
            <NoGames navigation={navigation} />
          ) : (
            <GamesIndex
              games={list}
              initial={parseGameQuery(searchParamsOf(searchParams))}
              navigation={navigation}
            />
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
        metadata: ({ params }) => gameMetadata(catalog, params.slug),
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
    sitemapPaths: () => gameSitemapPaths(catalog),
    version: "1.0.0",
  };
}
