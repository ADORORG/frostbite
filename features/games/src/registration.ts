import { defineFeature } from "@ador/plugin-kit";
import type { ChainOption } from "@ador/shared/chain";
import {
  gamePagePath,
  gameSyncRoute,
  gamesNavigationLabel,
  gamesPath,
  type GameManifest,
} from "@ador/shared/games";

// The public games catalog and detail pages, and the one API route that saves a signed-in player's state. The games it lists are supplied explicitly (one line per game
// in the platform's game configuration), so removing this one registration removes the pages and their
// navigation, and adding a game never touches this feature.
export function createGamesFeature(
  games: readonly GameManifest[],
  chains: readonly ChainOption[],
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
      routes: [gameSyncRoute],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-games/entrypoint").then(
        ({ createGamesEntrypoint }) => createGamesEntrypoint(games, chains),
      ),
  });
}
