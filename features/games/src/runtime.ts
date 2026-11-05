import {
  createDrizzleGameSyncRepository,
  createGameSyncService,
} from "@frostbite/game-saves";
import { resolveGameHostPolicy } from "@frostbite/game-sdk/policy";
import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import type { GameManifest } from "@frostbite/shared/games";

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
          new Map(
            milestones.map(
              ({ claimPolicy, id: milestoneId, maxCount, target }) => [
                milestoneId,
                { claimPolicy, maxCount, target },
              ],
            ),
          ),
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
