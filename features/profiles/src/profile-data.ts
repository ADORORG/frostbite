import type { DatabaseClient } from "@frostbite/database/connection";
import { createDrizzleGameClaimRepository } from "@frostbite/game-claims";
import { bestsOf } from "@frostbite/game-runs";
import type { PublicProfileView } from "@frostbite/shared/profiles";

// What a profile page shows besides the player: the best score the platform's own replay reached in each game, and the milestones minted.
// Both are the player's records as the database holds them, narrowed to the games the platform lists, so a game that was unlisted
// leaves a profile with no trace of it. Only completed claims count as minted (the same ones a game's public gallery shows).
export function createProfileData(
  database: DatabaseClient,
  listed: ReadonlySet<string>,
) {
  const claims = createDrizzleGameClaimRepository(database, {
    clock: () => new Date(),
  });
  return {
    async load(userId: string): Promise<{
      readonly bests: PublicProfileView["bests"];
      readonly mints: PublicProfileView["mints"];
    }> {
      const [bests, minted] = await Promise.all([
        bestsOf(database, userId),
        claims.listComplete(userId),
      ]);
      return {
        bests: bests
          .filter(({ gameId }) => listed.has(gameId))
          .map(({ achievedAt, gameId, score }) => ({
            achievedAt: achievedAt.toISOString(),
            gameId,
            score,
          })),
        mints: minted
          .filter(({ gameId }) => listed.has(gameId))
          .map(({ gameId, id, milestoneId, updatedAt }) => ({
            claimId: id,
            gameId,
            milestoneId,
            mintedAt: updatedAt.toISOString(),
          })),
      };
    },
  };
}
export type ProfileData = ReturnType<typeof createProfileData>;
