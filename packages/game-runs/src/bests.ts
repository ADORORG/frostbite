import type { DatabaseClient } from "@frostbite/database/connection";
import { gameRuns } from "@frostbite/database/schema/game-runs";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

// A player's best score in a game, as the platform's own replay reached it, and when that run was settled.
export interface RunBest {
  readonly achievedAt: Date;
  readonly gameId: string;
  readonly score: number;
}

// The best verified score of a player in each game they have one in. Only runs the platform replayed and found sound count (`verdict`
// is `verified` and the run kept a score), so a score a game merely reported never appears. When a score was reached twice, the earlier
// run is the one named. Reads the player's own runs, so what it costs follows how many games they have played, not how many runs.
export async function bestsOf(
  database: DatabaseClient,
  userId: string,
): Promise<readonly RunBest[]> {
  const rows = await database
    .selectDistinctOn([gameRuns.gameId], {
      gameId: gameRuns.gameId,
      score: gameRuns.score,
      submittedAt: gameRuns.submittedAt,
    })
    .from(gameRuns)
    .where(
      and(
        eq(gameRuns.userId, userId),
        eq(gameRuns.verdict, "verified"),
        isNotNull(gameRuns.score),
        isNotNull(gameRuns.submittedAt),
      ),
    )
    .orderBy(
      asc(gameRuns.gameId),
      desc(gameRuns.score),
      asc(gameRuns.submittedAt),
    );
  return rows.flatMap(({ gameId, score, submittedAt }) =>
    score === null || submittedAt === null
      ? []
      : [{ achievedAt: submittedAt, gameId, score }],
  );
}
