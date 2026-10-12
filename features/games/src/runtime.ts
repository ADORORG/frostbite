import {
  createDrizzleGameSyncRepository,
  createGameSyncService,
} from "@ador/game-saves";
import { resolveGameHostPolicy } from "@ador/game-sdk/policy";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@ador/database/connection";
import { memoizeUntilFailure } from "@ador/plugin-kit/lazy";
import type { GameManifest } from "@ador/shared/games";

// The account side of the games: one connection pool, made on first use, so a deployment that never syncs a
// game never connects. The size limit is the host policy's, the same one the game is held to in the page.
export function createGameSyncResolver(
  games: readonly GameManifest[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async () =>
    createGameSyncService({
      clock: () => new Date(),
      games: new Map(
        games.map(({ id, milestones }) => [
          id,
          new Set(milestones.map((milestone) => milestone.id)),
        ]),
      ),
      maxProgressBytes: resolveGameHostPolicy().progressMaxBytes,
      repository: createDrizzleGameSyncRepository(
        createDatabaseClient(
          createDatabasePool(parseDatabaseEnvironment(environment)),
        ),
      ),
    }),
  );
}
