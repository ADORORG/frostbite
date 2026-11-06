import type { DatabaseTransaction } from "@frostbite/database/connection";
import { gameMilestoneUnlocks } from "@frostbite/database/schema/game-saves";

// Records milestones the platform itself established by replaying a run, in the transaction that settles that run, so a
// verdict and its milestones stand or fall together. A milestone already held as self-reported is upgraded and keeps
// its unlock time and count; one not yet held is unlocked at `at`. A verified level is never lowered, and applying the
// same verdict again changes nothing. Which ids a verdict may grant is decided before this is called (the manifest).
export async function recordVerifiedMilestones(
  transaction: DatabaseTransaction,
  input: {
    readonly at: Date;
    readonly earned: readonly string[];
    readonly gameId: string;
    readonly userId: string;
  },
): Promise<void> {
  if (input.earned.length === 0) return;
  await transaction
    .insert(gameMilestoneUnlocks)
    .values(
      input.earned.map((milestoneId) => ({
        count: 1,
        gameId: input.gameId,
        milestoneId,
        unlockedAt: input.at,
        userId: input.userId,
        verification: "replay-verified",
      })),
    )
    .onConflictDoUpdate({
      set: { verification: "replay-verified" },
      target: [
        gameMilestoneUnlocks.userId,
        gameMilestoneUnlocks.gameId,
        gameMilestoneUnlocks.milestoneId,
      ],
    });
}
