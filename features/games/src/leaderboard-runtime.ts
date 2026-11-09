import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import {
  playersOnBoard,
  rankOf,
  topScores,
  windowEndsAt,
  windowStartOf,
} from "@frostbite/game-runs";
import { memoizeUntilFailure } from "@frostbite/plugin-kit/lazy";
import { leaderboardSize } from "@frostbite/shared/games";
import { profileAvatarSchema } from "@frostbite/shared/profiles";

import type { Leaderboards } from "./application/leaderboard-operations.ts";

function namedProfile(
  profile: { readonly avatar: string; readonly name: string } | null,
) {
  const avatar = profileAvatarSchema.safeParse(profile?.avatar);
  return profile === null || !avatar.success
    ? null
    : { avatar: avatar.data, name: profile.name };
}

// The boards, read from the database on first use through one connection pool. The period a request means is the one the clock is in now.
export function createLeaderboardResolver(
  clock: () => Date = () => new Date(),
  environment: NodeJS.ProcessEnv = process.env,
) {
  return memoizeUntilFailure(async (): Promise<Leaderboards> => {
    const database = createDatabaseClient(
      createDatabasePool(parseDatabaseEnvironment(environment)),
    );
    const periodOf = (gameId: string, kind: "all" | "month" | "week") => ({
      gameId,
      kind,
      start: windowStartOf(kind, clock()),
    });
    return {
      mine: (gameId, window, userId) =>
        rankOf(database, periodOf(gameId, window), userId),
      top: async (gameId, window) => {
        const period = periodOf(gameId, window);
        const [rows, players] = await Promise.all([
          topScores(database, period, leaderboardSize),
          playersOnBoard(database, period),
        ]);
        return {
          endsAt: windowEndsAt(window, period.start),
          entries: rows.map((row) => ({
            achievedAt: row.achievedAt.toISOString(),
            // A picture the platform does not offer (a stored value that drifted) is shown as no profile, not as a broken one.
            profile: namedProfile(row.profile),
            rank: row.rank,
            score: row.score,
          })),
          players,
        };
      },
    };
  });
}
