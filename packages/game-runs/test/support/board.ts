import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { gameRuns, gameScoreBests } from "@frostbite/database";
import { and, eq, sql } from "drizzle-orm";

import type { BoardWindow } from "../../src/leaderboard.ts";
import { database, digest } from "./database.ts";

// Each test works on a game of its own: the database lasts for the whole file.
export const freshGame = () => `board-game-${randomUUID().slice(0, 8)}`;
export const at = (iso: string) => new Date(iso);
export async function settle(
  userId: string,
  gameId: string,
  score: number | null,
  when: string,
  verdict: "rejected" | "verified" = "verified",
) {
  await database.insert(gameRuns).values({
    expiresAt: at("2030-01-01T00:00:00.000Z"),
    gameId,
    id: randomUUID(),
    issuedAt: at("2026-01-01T00:00:00.000Z"),
    score,
    seed: 1,
    state: "submitted",
    submittedAt: at(when),
    userId,
    verdict,
    verifierDigest: digest,
  });
}
export const rowOf = async (
  gameId: string,
  kind: BoardWindow,
  userId: string,
) =>
  (
    await database
      .select()
      .from(gameScoreBests)
      .where(
        and(
          eq(gameScoreBests.gameId, gameId),
          eq(gameScoreBests.windowKind, kind),
          eq(gameScoreBests.userId, userId),
        ),
      )
  ).map(({ achievedAt, score, windowStart }) => ({
    achievedAt,
    score,
    windowStart,
  }));

// The migration's own backfill, run for one game: what the table would hold had the runs settled before it existed.
export async function runBackfill(gameId: string) {
  const migrations = resolve(
    import.meta.dirname,
    "../../../database/migrations",
  );
  const file = readdirSync(migrations).find((name) =>
    name.endsWith("_game_score_bests"),
  );
  const script = readFileSync(
    resolve(migrations, file ?? "missing", "migration.sql"),
    "utf8",
  );
  const backfill = script.slice(
    script.lastIndexOf('INSERT INTO "frostbite"."game_score_bests"'),
  );
  await database.execute(
    sql.raw(
      backfill.replace(
        "WHERE r.state = 'submitted'",
        `WHERE r.game_id = '${gameId}' AND r.state = 'submitted'`,
      ),
    ),
  );
}
