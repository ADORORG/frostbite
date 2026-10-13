import type { DatabaseClient } from "@ador/database/connection";
import {
  gameMilestoneUnlocks,
  gameSaves,
} from "@ador/database/schema/game-saves";
import { gameProgressSchema, type GameState } from "@ador/shared/games";
import { and, eq, sql } from "drizzle-orm";

import type { GameSyncRepository } from "./repository.ts";

export function createDrizzleGameSyncRepository(
  database: DatabaseClient,
): GameSyncRepository {
  return {
    change: (userId, gameId, decide) =>
      database.transaction(async (transaction) => {
        // The row exists before it is locked, so the first sync of a game locks like any other.
        await transaction
          .insert(gameSaves)
          .values({ gameId, userId })
          .onConflictDoNothing();
        const [save] = await transaction
          .select()
          .from(gameSaves)
          .where(
            and(eq(gameSaves.userId, userId), eq(gameSaves.gameId, gameId)),
          )
          .for("update");
        // The row was inserted above and is locked now; its absence would mean a concurrent delete of the player.
        if (save === undefined)
          throw new Error("The player's game row disappeared during a sync.");
        const unlocks = await transaction
          .select()
          .from(gameMilestoneUnlocks)
          .where(
            and(
              eq(gameMilestoneUnlocks.userId, userId),
              eq(gameMilestoneUnlocks.gameId, gameId),
            ),
          );
        const stored: GameState = {
          milestones: unlocks.map((row) => ({
            id: row.milestoneId,
            unlockedAt: row.unlockedAt.toISOString(),
            verification: "self-reported",
          })),
          // The column is read back through the contract, so a row edited by hand cannot become a state.
          progress:
            save.progressSavedAt != null
              ? {
                  savedAt: save.progressSavedAt.toISOString(),
                  state: gameProgressSchema.shape.state.parse(save.progress),
                }
              : null,
        };
        const merged = decide(stored);
        // A merge never removes a save, so a changed save is always a newer one to store.
        if (
          merged.progress !== null &&
          merged.progress.savedAt !== stored.progress?.savedAt
        )
          await transaction
            .update(gameSaves)
            .set({
              // A saved state may itself be JSON `null`, which is not the same as no save, so the value is
              // written as JSON text rather than left to the driver, which would store SQL NULL.
              progress: sql`${JSON.stringify(merged.progress.state)}::jsonb`,
              progressBytes: Buffer.byteLength(
                JSON.stringify(merged.progress.state),
              ),
              progressSavedAt: new Date(merged.progress.savedAt),
              updatedAt: new Date(),
            })
            .where(
              and(eq(gameSaves.userId, userId), eq(gameSaves.gameId, gameId)),
            );
        const known = new Map(stored.milestones.map((m) => [m.id, m]));
        for (const record of merged.milestones) {
          if (known.get(record.id)?.unlockedAt === record.unlockedAt) continue;
          await transaction
            .insert(gameMilestoneUnlocks)
            .values({
              gameId,
              milestoneId: record.id,
              unlockedAt: new Date(record.unlockedAt),
              userId,
            })
            .onConflictDoUpdate({
              set: { unlockedAt: new Date(record.unlockedAt) },
              target: [
                gameMilestoneUnlocks.userId,
                gameMilestoneUnlocks.gameId,
                gameMilestoneUnlocks.milestoneId,
              ],
            });
        }
        return { playerId: save.playerId, state: merged };
      }),
  };
}
