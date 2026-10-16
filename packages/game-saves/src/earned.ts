import type { DatabaseClient } from "@ador/database/connection";
import { gameMilestoneUnlocks } from "@ador/database/schema/game-saves";
import { and, eq } from "drizzle-orm";

// Whether the milestone is on the player's account as earned, at any level (reported by the game or replay-verified). What
// may be done with it, such as claiming it on chain, is for the caller to decide from the milestone's manifest; this only
// reads the account.
export async function hasEarnedMilestone(
  database: DatabaseClient,
  input: {
    readonly gameId: string;
    readonly milestoneId: string;
    readonly userId: string;
  },
): Promise<boolean> {
  const [row] = await database
    .select({ milestoneId: gameMilestoneUnlocks.milestoneId })
    .from(gameMilestoneUnlocks)
    .where(
      and(
        eq(gameMilestoneUnlocks.userId, input.userId),
        eq(gameMilestoneUnlocks.gameId, input.gameId),
        eq(gameMilestoneUnlocks.milestoneId, input.milestoneId),
      ),
    )
    .limit(1);
  return row !== undefined;
}
