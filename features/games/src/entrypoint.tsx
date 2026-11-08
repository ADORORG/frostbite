import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";
import { privatePage } from "@frostbite/plugin-kit/page-metadata";
import type { ShareConfig } from "@frostbite/share";
import type { ChainOption } from "@frostbite/shared/chain";
import { homeSectionOrder } from "@frostbite/shared/platform";
import {
  gamePagePath,
  gamesPath,
  myMilestonesPath,
  shareIdSchema,
  sharedPagePath,
  type GameManifest,
} from "@frostbite/shared/games";

import {
  createListGameClaimsOperation,
  createRefreshGameClaimOperation,
  createStartGameClaimOperation,
  createSubmitGameClaimOperation,
} from "./application/claims-operations.ts";
import {
  createGetGalleryPictureOperation,
  createListGalleryMintsOperation,
} from "./application/gallery-operations.ts";
import { createGalleryResolver } from "./gallery-runtime.ts";
import {
  createGetMintedPictureOperation,
  createListMintedMilestonesOperation,
} from "./application/minted-operation.ts";
import {
  createCreateShareOperation,
  createGetSharedPictureOperation,
  createRevokeShareOperation,
} from "./application/shares-operations.ts";
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
import { sharesResolverFor } from "./shares-runtime.ts";
import { sharedModel } from "./domain/shared-model.ts";
import {
  gameMetadata,
  gameSitemapPaths,
  gamesIndexMetadata,
  sharedMetadata,
} from "./metadata.ts";
import { GameDetail } from "./ui/game-detail.tsx";
import { GamesIndex } from "./ui/games-index.tsx";
import { GamesRail } from "./ui/games-rail.tsx";
import { MyMilestones } from "./ui/my-milestones.tsx";
import { SharedNotFound, SharedPage } from "./ui/shared-page.tsx";
import type { GameWalletConfig } from "./wallet-config.ts";
import { GameNotFound, NoGames } from "./ui/states.tsx";

export function createGamesEntrypoint(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
  wallet: GameWalletConfig,
  runs: GameRunsConfig,
  claims: GameClaimsConfig,
  share?: ShareConfig,
): FeatureEntrypoint {
  const catalog = createGameCatalog(games, chains);
  const runsService = createGameRunsResolver(games, runs);
  const claimsService = createGameClaimsResolver(games, claims);
  const sharesService = sharesResolverFor(games);
  const galleryService = createGalleryResolver();
  const listedGames: ReadonlySet<string> = new Set(games.map(({ id }) => id));
  // The thing a link shows, or null for an identifier that is not one, a link that was ended, or one that never was.
  const sharedThing = async (id: string | undefined) => {
    const parsed = shareIdSchema.safeParse(id);
    return parsed.success
      ? await (await sharesService()).get(parsed.data)
      : null;
  };
  // What a shared page shows: the thing, with the sharer's own mints and how many players minted it. The sharer is never named. A
  // chain that cannot be reached costs the pictures and the count, not the page.
  const sharedPageModel = async (id: string | undefined) => {
    const parsed = shareIdSchema.safeParse(id);
    const found = parsed.success
      ? await (await sharesService()).find(parsed.data)
      : null;
    if (parsed.data === undefined || found === null) return null;
    const needsMints = found.thing.kind !== "score";
    const claimsLive = await claimsService().catch(() => null);
    return sharedModel({
      counts:
        claimsLive !== null && found.thing.kind === "milestone"
          ? await claimsLive.mintCounts(found.thing.gameId).catch(() => null)
          : null,
      games: catalog.list(),
      id: parsed.data,
      mints:
        claimsLive !== null && needsMints
          ? await claimsLive.minted(found.owner).catch(() => [])
          : [],
      thing: found.thing,
    });
  };
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
      registerHttpOperation(createCreateShareOperation(sharesService)),
      registerHttpOperation(createRevokeShareOperation(sharesService)),
      registerHttpOperation(
        createGetSharedPictureOperation(sharesService, claimsService),
      ),
      registerHttpOperation(
        createListGalleryMintsOperation(galleryService, listedGames),
      ),
      registerHttpOperation(
        createGetGalleryPictureOperation(
          galleryService,
          claimsService,
          listedGames,
        ),
      ),
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
            {...(share === undefined ? {} : { share })}
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
              <GameDetail
                game={game}
                navigation={navigation}
                {...(share === undefined ? {} : { share })}
                wallet={wallet}
              />
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
      {
        access,
        metadata: async ({ params }) =>
          sharedMetadata(params.id ?? "", await sharedThing(params.id), games),
        path: sharedPagePath,
        render: async ({ navigation, params }) => {
          const model = await sharedPageModel(params.id);
          return model === null ? (
            <SharedNotFound navigation={navigation} />
          ) : (
            <SharedPage model={model} navigation={navigation} />
          );
        },
      },
    ],
    sitemapPaths: () => gameSitemapPaths(catalog),
    version: "1.0.0",
  };
}
