import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { playsInWindow, rankGames, recordPlay } from "@frostbite/game-runs";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";

import type { Plays } from "./application/plays-operations.ts";
import type { GameHeat } from "@frostbite/shared/games";

export const hotMaxAgeMs = 60_000;

// The runs started in each game, kept in the database on first use through one connection pool, and the ranking read from them.
export function createPlaysResolver(
  clock: () => Date = () => new Date(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  const database = memoizeUntilFailure(async () =>
    createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(environment)),
    ),
  );
  const plays = async (): Promise<Plays> => {
    const client = await database();
    return { record: (gameId) => recordPlay(client, gameId, clock()) };
  };
  // The ranked games now, kept for `hotMaxAgeMs` so a busy page does not read the database on every view; the pages show none when it cannot
  // be read, because a rail that fails to rank is still a rail of games.
  let kept: {
    readonly at: number;
    readonly games: readonly GameHeat[];
  } | null = null;
  const hot = async (): Promise<readonly GameHeat[]> => {
    const now = clock().getTime();
    if (kept !== null && now - kept.at < hotMaxAgeMs) return kept.games;
    try {
      const client = await database();
      const games = rankGames(await playsInWindow(client, clock()));
      kept = { at: now, games };
      return games;
    } catch {
      return [];
    }
  };
  return { hot, plays };
}
