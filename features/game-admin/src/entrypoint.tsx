import { registerHttpOperation } from "@frostbite/http/registered-operation";
import type { FeatureEntrypoint } from "@frostbite/plugin-kit";
import {
  gameAdminCapability,
  gameAdminDetailPath,
  gameAdminPath,
  type GameManifest,
} from "@frostbite/shared/games";

import {
  createGetPlatformFeeOperation,
  createListGameMintsOperation,
  createListGameMintTotalsOperation,
  createSetPlatformFeeOperation,
} from "./application/mints.ts";
import {
  createListStepsOperation,
  createListTemplatesOperation,
  createRecordContractOperation,
  createRefreshStepOperation,
  createStartStepOperation,
  createSubmitStepOperation,
} from "./application/operations.ts";
import type { GameAdminConfig } from "./config.ts";
import { adminGames } from "./game-info.ts";
import { createGameAdminResolver } from "./runtime.ts";
import { GameSurface, GamesSurface } from "./ui/surfaces.tsx";

const access = { capability: gameAdminCapability, kind: "platform" } as const;

export function createGameAdminEntrypoint(
  games: readonly GameManifest[],
  config: GameAdminConfig,
): FeatureEntrypoint {
  const known = adminGames(games);
  const resolve = createGameAdminResolver(known, config);
  return {
    capabilities: [
      "api-routes",
      "authenticated-page",
      "navigation",
      "studio-page",
    ],
    id: "game-admin",
    operations: [
      registerHttpOperation(createListStepsOperation(resolve)),
      registerHttpOperation(createRecordContractOperation(resolve)),
      registerHttpOperation(createRefreshStepOperation(resolve)),
      registerHttpOperation(createStartStepOperation(resolve)),
      registerHttpOperation(createSubmitStepOperation(resolve)),
      registerHttpOperation(createListTemplatesOperation(resolve)),
      registerHttpOperation(createListGameMintsOperation(resolve)),
      registerHttpOperation(createListGameMintTotalsOperation(resolve)),
      registerHttpOperation(createGetPlatformFeeOperation(resolve)),
      registerHttpOperation(createSetPlatformFeeOperation(resolve)),
    ],
    pages: [
      {
        access,
        path: gameAdminPath,
        render: ({ navigation }) => (
          <GamesSurface
            explorerTxUrl={config.explorerTxUrl}
            fees={config.fees}
            games={known}
            navigation={navigation}
            signingWallets={config.signingWallets}
          />
        ),
      },
      {
        access,
        path: gameAdminDetailPath,
        render: ({ navigation, params }) => (
          <GameSurface
            explorerTxUrl={config.explorerTxUrl}
            fees={config.fees}
            game={known.find(({ id }) => id === params.gameId)}
            navigation={navigation}
            signingWallets={config.signingWallets}
          />
        ),
      },
    ],
    version: "1.0.0",
  };
}
