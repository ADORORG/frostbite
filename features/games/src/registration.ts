import { defineFeature } from "@ador/plugin-kit";
import type { ChainOption } from "@ador/shared/chain";
import {
  gamePagePath,
  gameSyncRoute,
  startGameRunRoute,
  submitGameRunRoute,
  gamesNavigationLabel,
  gamesPath,
  type GameManifest,
} from "@ador/shared/games";

import type { GameRunsConfig } from "./runs-config.ts";
import type { GameWalletConfig } from "./wallet-config.ts";

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
) {
  return defineFeature({
    manifest: {
      capabilities: ["api-routes", "navigation", "public-page"],
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
        { access: { kind: "public" }, path: gamePagePath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [gameSyncRoute, startGameRunRoute, submitGameRunRoute],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-games/entrypoint").then(
        ({ createGamesEntrypoint }) =>
          createGamesEntrypoint(games, chains, wallet, runs),
      ),
  });
}
