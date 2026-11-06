import type { DatabaseClient } from "@frostbite/database/connection";
import {
  gameMilestoneCounters,
  gameMilestoneUnlocks,
  gameSaves,
} from "@frostbite/database/schema/game-saves";
import {
  gameMilestoneRecordSchema,
  gameProgressSchema,
  type GameState,
} from "@frostbite/shared/games";
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
        const totals = await transaction
          .select()
          .from(gameMilestoneCounters)
          .where(
            and(
              eq(gameMilestoneCounters.userId, userId),
              eq(gameMilestoneCounters.gameId, gameId),
            ),
          );
        const stored: GameState = {
          counters: totals.map((row) => ({
            current: row.current,
            id: row.milestoneId,
          })),
          milestones: unlocks.map((row) => ({
            count: row.count,
            id: row.milestoneId,
            unlockedAt: row.unlockedAt.toISOString(),
            // Read back through the contract, so a value edited by hand cannot become a level.
            verification: gameMilestoneRecordSchema.shape.verification.parse(
              row.verification,
            ),
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
          const before = known.get(record.id);
          if (
            before?.unlockedAt === record.unlockedAt &&
            before.count === record.count &&
            before.verification === record.verification
          )
            continue;
          await transaction
            .insert(gameMilestoneUnlocks)
            .values({
              count: record.count,
              gameId,
              milestoneId: record.id,
              unlockedAt: new Date(record.unlockedAt),
              userId,
              verification: record.verification,
            })
            .onConflictDoUpdate({
              set: {
                count: record.count,
                unlockedAt: new Date(record.unlockedAt),
                verification: record.verification,
              },
              target: [
                gameMilestoneUnlocks.userId,
                gameMilestoneUnlocks.gameId,
                gameMilestoneUnlocks.milestoneId,
              ],
            });
        }
        const totalsBefore = new Map(
          stored.counters.map((c) => [c.id, c.current]),
        );
        for (const counter of merged.counters) {
          if (totalsBefore.get(counter.id) === counter.current) continue;
          await transaction
            .insert(gameMilestoneCounters)
            .values({
              current: counter.current,
              gameId,
              milestoneId: counter.id,
              userId,
            })
            .onConflictDoUpdate({
              set: { current: counter.current, updatedAt: new Date() },
              target: [
                gameMilestoneCounters.userId,
                gameMilestoneCounters.gameId,
                gameMilestoneCounters.milestoneId,
              ],
            });
        }
        return { playerId: save.playerId, state: merged };
      }),
  };
}
