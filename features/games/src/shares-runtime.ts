import { randomUUID } from "node:crypto";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { milestoneLevel } from "@frostbite/game-saves";
import {
  createDrizzleGameShareRepository,
  createGameSharesService,
} from "@frostbite/game-shares";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import type { GameManifest } from "@frostbite/shared/games";

import { milestoneRulesOf } from "./domain/milestone-rules.ts";

// The account side of sharing: one connection pool, made on first use, and the service over the shares table and the account's
// milestones. The same resolver serves the HTTP operations, the shared page and its preview picture (`sharesResolverFor`).
export function createGameSharesResolver(
  games: readonly GameManifest[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async () => {
    const database = createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(environment)),
    );
    return createGameSharesService({
      clock: () => new Date(),
      games: milestoneRulesOf(games),
      level: (input) => milestoneLevel(database, input),
      newId: randomUUID,
      repository: createDrizzleGameShareRepository(database),
    });
  });
}

// One resolver per list of games, so the entrypoint and the preview picture's route (which is not part of the feature) share a pool.
const resolvers = new WeakMap<
  readonly GameManifest[],
  ReturnType<typeof createGameSharesResolver>
>();
export function sharesResolverFor(games: readonly GameManifest[]) {
  const known = resolvers.get(games);
  if (known !== undefined) return known;
  const made = createGameSharesResolver(games);
  resolvers.set(games, made);
  return made;
}
