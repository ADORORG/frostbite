import { defineFeature } from "@frostbite/plugin-kit";
import type { ShareConfig } from "@frostbite/share";
import type { ChainOption } from "@frostbite/shared/chain";
import {
  gamePagePath,
  gameSyncRoute,
  createShareRoute,
  getMintedPictureRoute,
  getSharedPictureRoute,
  listGameClaimsRoute,
  listMintedMilestonesRoute,
  myMilestonesPath,
  refreshGameClaimRoute,
  revokeShareRoute,
  sharedPagePath,
  startGameClaimRoute,
  startGameRunRoute,
  submitGameClaimRoute,
  submitGameRunRoute,
  gamesNavigationLabel,
  gamesPath,
  type GameManifest,
} from "@frostbite/shared/games";

import type { GameClaimsConfig } from "./claims-config.ts";
import type { GameRunsConfig } from "./runs-config.ts";
import type { GameWalletConfig } from "./wallet-config.ts";

export type { GameClaimsConfig } from "./claims-config.ts";
export type { GameRunsConfig } from "./runs-config.ts";
export type { GameWalletConfig } from "./wallet-config.ts";

// The public games catalog and detail pages, and the API routes that save a signed-in player's state and start and settle their replay-verified runs. The games it lists are supplied explicitly (one line per game
// in the platform's game configuration), so removing this one registration removes the pages and their
// navigation, and adding a game never touches this feature.
export function createGamesFeature(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
  wallet: GameWalletConfig,
  runs: GameRunsConfig,
  claims: GameClaimsConfig,
  share?: ShareConfig,
) {
  return defineFeature({
    manifest: {
      capabilities: [
        "api-routes",
        "authenticated-page",
        "home-section",
        "navigation",
        "public-page",
      ],
      dependencies: ["accounts"],
      id: "games",
      navigation: [
        {
          access: { kind: "public" },
          area: "main",
          href: gamesPath,
          label: gamesNavigationLabel,
          order: 20,
        },
      ],
      pages: [
        { access: { kind: "public" }, path: gamesPath },
        { access: { kind: "authenticated" }, path: myMilestonesPath },
        { access: { kind: "public" }, path: gamePagePath },
        { access: { kind: "public" }, path: sharedPagePath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [
        gameSyncRoute,
        startGameRunRoute,
        submitGameRunRoute,
        startGameClaimRoute,
        submitGameClaimRoute,
        refreshGameClaimRoute,
        listGameClaimsRoute,
        listMintedMilestonesRoute,
        getMintedPictureRoute,
        createShareRoute,
        revokeShareRoute,
        getSharedPictureRoute,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@frostbite/feature-games/entrypoint").then(
        ({ createGamesEntrypoint }) =>
          createGamesEntrypoint(games, chains, wallet, runs, claims, share),
      ),
  });
}
