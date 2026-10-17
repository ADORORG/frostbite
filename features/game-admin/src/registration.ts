import { defineFeature } from "@ador/plugin-kit";
import {
  gameAdminCapability,
  gameAdminDetailPath,
  gameAdminNavigationLabel,
  gameAdminPath,
  gameAdminRoutes,
  type GameManifest,
} from "@ador/shared/games";

import type { GameAdminConfig } from "./config.ts";

export type { GameAdminConfig } from "./config.ts";

const access = { capability: gameAdminCapability, kind: "platform" } as const;

// Staff administration of games' rewards contracts: define milestones, pause and resume claims, and the log of what was done. The
// games it lists come from the platform's game configuration, and the contract and chain from `GameAdminConfig`; removing this one
// registration removes every route, page and navigation entry.
export function createGameAdminFeature(
  games: readonly GameManifest[],
  config: GameAdminConfig,
) {
  return defineFeature({
    manifest: {
      capabilities: [
        "api-routes",
        "authenticated-page",
        "navigation",
        "studio-page",
      ],
      dependencies: ["accounts", "games"],
      id: "game-admin",
      navigation: [
        {
          access,
          area: "admin",
          href: gameAdminPath,
          label: gameAdminNavigationLabel,
          order: 20,
        },
      ],
      pages: [
        { access, path: gameAdminPath },
        { access, path: gameAdminDetailPath },
      ],
      requiredDecisionGates: [],
      requiredProviderCapabilities: [],
      routes: [
        gameAdminRoutes.list,
        gameAdminRoutes.record,
        gameAdminRoutes.refresh,
        gameAdminRoutes.start,
        gameAdminRoutes.submit,
        gameAdminRoutes.templates,
      ],
      version: "1.0.0",
    },
    load: async () =>
      import("@ador/feature-game-admin/entrypoint").then(
        ({ createGameAdminEntrypoint }) =>
          createGameAdminEntrypoint(games, config),
      ),
  });
}
