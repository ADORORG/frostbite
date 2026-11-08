import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { createPublicMints } from "@frostbite/game-claims";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";

// The public side of mints: one connection pool, made on first use, so a deployment that never opens a gallery never connects.
export function createGalleryResolver(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async () =>
    createPublicMints(
      createDatabaseClient(
        createDatabasePool(parseDatabaseEnvironment(environment)),
      ),
    ),
  );
}
