import type { DatabaseClient } from "@frostbite/database/connection";
import { gamePlayDays } from "@frostbite/database/schema/game-play-days";
import { heatLevels, type GameHeat } from "@frostbite/shared/games";
import { gte, sql } from "drizzle-orm";

import { defaultHotPolicy, type HotPolicy } from "./hot-policy.ts";

const dayMs = 86_400_000;

export interface PlayCount {
  readonly gameId: string;
  readonly plays: number;
}

const day = (at: Date) => at.toISOString().slice(0, 10);

// Counts one run started in a game, on the day (UTC) it started. The count is added in the database, so two starts at once are two.
export async function recordPlay(
  database: DatabaseClient,
  gameId: string,
  at: Date,
): Promise<void> {
  await database
    .insert(gamePlayDays)
    .values({ day: day(at), gameId, plays: 1 })
    .onConflictDoUpdate({
      set: { plays: sql`${gamePlayDays.plays} + 1` },
      target: [gamePlayDays.gameId, gamePlayDays.day],
    });
}

// The runs started in each game in the policy's window ending today, busiest first, a tie going to the game named first.
export async function playsInWindow(
  database: DatabaseClient,
  now: Date,
  policy: HotPolicy = defaultHotPolicy,
): Promise<readonly PlayCount[]> {
  const since = day(new Date(now.getTime() - (policy.windowDays - 1) * dayMs));
  const rows = await database
    .select({
      gameId: gamePlayDays.gameId,
      plays: sql<number>`sum(${gamePlayDays.plays})::int`,
    })
    .from(gamePlayDays)
    .where(gte(gamePlayDays.day, since))
    .groupBy(gamePlayDays.gameId);
  return rows;
}

// Ranks counts under the policy: games under the minimum are left out, the rest are ordered busiest first (a tie going to the game named
// first, so the order never flickers), and each gets a heat against the busiest. Pure, so it is tested without a database.
export function rankGames(
  counts: readonly PlayCount[],
  policy: HotPolicy = defaultHotPolicy,
): readonly GameHeat[] {
  const ranked = counts
    .filter(({ plays }) => plays >= policy.minPlays)
    .sort((a, b) => b.plays - a.plays || a.gameId.localeCompare(b.gameId));
  const busiest = ranked[0]?.plays ?? 1;
  return ranked.map(({ gameId, plays }, index) => ({
    gameId,
    heat: Math.max(1, Math.ceil((heatLevels * plays) / busiest)),
    hot: index < policy.hotCount,
    rank: index + 1,
  }));
}
