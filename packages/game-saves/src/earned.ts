import type { DatabaseClient } from "@frostbite/database/connection";
import { gameMilestoneUnlocks } from "@frostbite/database/schema/game-saves";
import { and, eq } from "drizzle-orm";

export type MilestoneLevel = "replay-verified" | "self-reported";

// How the milestone is on the player's account, or null when it is not there: reported by the game, or replay-verified. What may be done
// with it, such as claiming it on chain or sharing it, is for the caller to decide from the milestone's manifest; this only reads the account.
export async function milestoneLevel(
  database: DatabaseClient,
  input: {
    readonly gameId: string;
    readonly milestoneId: string;
    readonly userId: string;
  },
): Promise<MilestoneLevel | null> {
  const [row] = await database
    .select({ level: gameMilestoneUnlocks.verification })
    .from(gameMilestoneUnlocks)
    .where(
      and(
        eq(gameMilestoneUnlocks.userId, input.userId),
        eq(gameMilestoneUnlocks.gameId, input.gameId),
        eq(gameMilestoneUnlocks.milestoneId, input.milestoneId),
      ),
    )
    .limit(1);
  if (row === undefined) return null;
  // The column is constrained to these two by the database.
  return row.level === "replay-verified" ? "replay-verified" : "self-reported";
}

// Whether the milestone is on the player's account as earned, at any level.
export async function hasEarnedMilestone(
  database: DatabaseClient,
  input: Parameters<typeof milestoneLevel>[1],
): Promise<boolean> {
  return (await milestoneLevel(database, input)) !== null;
}
