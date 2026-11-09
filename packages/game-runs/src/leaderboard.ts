import type { DatabaseClient } from "@frostbite/database/connection";
import { gameScoreBests } from "@frostbite/database/schema/game-score-bests";
import { playerProfiles } from "@frostbite/database/schema/player-profiles";
import { and, asc, count, eq, gt, sql } from "drizzle-orm";

// The periods a board is kept for (see `game_score_bests`): one for all time, then each month and each week, in UTC.
export const boardWindows = ["all", "month", "week"] as const;
export type BoardWindow = (typeof boardWindows)[number];

const allTime = "1970-01-01";
const dayMs = 86_400_000;

// The day a period starts on, as the database wrote it: all time has one period, a month starts on its first day, a week on its Monday, all
// in UTC. It must agree with the trigger that keeps the table, so a test settles runs at the edges and compares.
export function windowStartOf(kind: BoardWindow, at: Date): string {
  if (kind === "all") return allTime;
  const day = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
  if (kind === "month") return `${day.toISOString().slice(0, 7)}-01`;
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * dayMs)
    .toISOString()
    .slice(0, 10);
}

// When the period that starts on `start` ends and the next begins, or null for all time.
export function windowEndsAt(kind: BoardWindow, start: string): Date | null {
  if (kind === "all") return null;
  const from = new Date(`${start}T00:00:00.000Z`);
  return kind === "week"
    ? new Date(from.getTime() + 7 * dayMs)
    : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

export interface BoardRow {
  readonly achievedAt: Date;
  // The name and picture the player chose, only when they switched their public page on; otherwise null and the row is anonymous.
  readonly profile: {
    readonly avatar: string;
    readonly name: string;
  } | null;
  // 1 plus the number of players with a higher score: players with the same score share a rank.
  readonly rank: number;
  readonly score: number;
  readonly userId: string;
}

// The best verified scores of a game in one period, highest first, the player who reached a score first ahead of one who matched it later.
// Reads the index of `game_score_bests`, so it costs the same whatever the number of runs.
export async function topScores(
  database: DatabaseClient,
  period: {
    readonly gameId: string;
    readonly kind: BoardWindow;
    readonly start: string;
  },
  limit: number,
): Promise<readonly BoardRow[]> {
  const rows = await database
    .select({
      achievedAt: gameScoreBests.achievedAt,
      avatar: playerProfiles.avatar,
      name: playerProfiles.name,
      rank: sql<number>`rank() over (order by ${gameScoreBests.score} desc)::int`,
      score: gameScoreBests.score,
      userId: gameScoreBests.userId,
    })
    .from(gameScoreBests)
    .leftJoin(
      playerProfiles,
      and(
        eq(playerProfiles.userId, gameScoreBests.userId),
        eq(playerProfiles.visible, true),
      ),
    )
    .where(inPeriod(period))
    .orderBy(
      // The index is built `desc nulls last`; asking for the same order lets it be read as it is, with no sort.
      sql`${gameScoreBests.score} desc nulls last`,
      asc(gameScoreBests.achievedAt),
    )
    .limit(limit);
  return rows.map(({ avatar, name, ...row }) => ({
    ...row,
    profile: avatar === null || name === null ? null : { avatar, name },
  }));
}

// One player's place in a period, or null when they have no score in it.
export async function rankOf(
  database: DatabaseClient,
  period: {
    readonly gameId: string;
    readonly kind: BoardWindow;
    readonly start: string;
  },
  userId: string,
): Promise<{ readonly rank: number; readonly score: number } | null> {
  const [own] = await database
    .select({ score: gameScoreBests.score })
    .from(gameScoreBests)
    .where(and(inPeriod(period), eq(gameScoreBests.userId, userId)));
  if (own === undefined) return null;
  const [higher] = await database
    .select({ n: count() })
    .from(gameScoreBests)
    .where(and(inPeriod(period), gt(gameScoreBests.score, own.score)));
  return { rank: (higher?.n ?? 0) + 1, score: own.score };
}

// How many players have a score in a period.
export async function playersOnBoard(
  database: DatabaseClient,
  period: {
    readonly gameId: string;
    readonly kind: BoardWindow;
    readonly start: string;
  },
): Promise<number> {
  const [row] = await database
    .select({ n: count() })
    .from(gameScoreBests)
    .where(inPeriod(period));
  return row?.n ?? 0;
}

const inPeriod = (period: {
  readonly gameId: string;
  readonly kind: BoardWindow;
  readonly start: string;
}) =>
  and(
    eq(gameScoreBests.gameId, period.gameId),
    eq(gameScoreBests.windowKind, period.kind),
    eq(gameScoreBests.windowStart, period.start),
  );
