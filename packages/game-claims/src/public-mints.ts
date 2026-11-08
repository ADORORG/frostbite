import type { DatabaseClient } from "@frostbite/database/connection";
import { gameMilestoneClaims } from "@frostbite/database/schema/game-claims";
import { gameMilestoneUnlocks } from "@frostbite/database/schema/game-saves";
import { and, eq, or } from "drizzle-orm";

import { createDrizzleGameClaimRepository } from "./drizzle-repository.ts";
import { createMintReport, type MintCursor } from "./mint-report.ts";

// A completed mint as a public gallery shows it: which milestone, when, the transaction, the wallet it was minted to, and how the account
// knew the milestone was earned (replay-verified, or only reported by the game). Nothing that names the player.
export interface PublicMint {
  readonly claimId: string;
  readonly milestoneId: string;
  readonly mintedAt: Date;
  readonly transactionId: string;
  readonly verification: "replay-verified" | "self-reported";
  readonly wallet: string;
}

// What a public gallery of a game's mints reads: a page of them, newest first, how many players minted each milestone, and who a completed
// claim belongs to (so its picture can be read for the gallery). Only claims the network's records show complete are ever here.
export function createPublicMints(database: DatabaseClient) {
  const report = createMintReport(database);
  const claims = createDrizzleGameClaimRepository(database, {
    clock: () => new Date(),
  });
  return {
    counts: (gameId: string) => claims.completeCounts(gameId),

    // The player and milestone of one completed claim, for reading its picture; none for a claim that is not complete.
    async owner(claimId: string) {
      const [row] = await database
        .select({
          gameId: gameMilestoneClaims.gameId,
          milestoneId: gameMilestoneClaims.milestoneId,
          userId: gameMilestoneClaims.userId,
        })
        .from(gameMilestoneClaims)
        .where(
          and(
            eq(gameMilestoneClaims.id, claimId),
            eq(gameMilestoneClaims.state, "complete"),
          ),
        );
      return row ?? null;
    },

    async page(
      gameId: string,
      pageSize: number,
      after?: MintCursor,
    ): Promise<{
      readonly mints: readonly PublicMint[];
      readonly next: MintCursor | null;
    }> {
      const { mints, next } = await report.recent(gameId, pageSize, after);
      // How each of the page's players holds the milestone: one read for the whole page.
      const unlocks =
        mints.length === 0
          ? []
          : await database
              .select({
                level: gameMilestoneUnlocks.verification,
                milestoneId: gameMilestoneUnlocks.milestoneId,
                userId: gameMilestoneUnlocks.userId,
              })
              .from(gameMilestoneUnlocks)
              .where(
                and(
                  eq(gameMilestoneUnlocks.gameId, gameId),
                  or(
                    ...mints.map(({ milestoneId, userId }) =>
                      and(
                        eq(gameMilestoneUnlocks.userId, userId),
                        eq(gameMilestoneUnlocks.milestoneId, milestoneId),
                      ),
                    ),
                  ),
                ),
              );
      const level = new Map(
        unlocks.map((row) => [`${row.userId}|${row.milestoneId}`, row.level]),
      );
      return {
        mints: mints.flatMap((mint) =>
          mint.transactionId === null
            ? []
            : [
                {
                  claimId: mint.claimId,
                  milestoneId: mint.milestoneId,
                  mintedAt: mint.completedAt,
                  transactionId: mint.transactionId,
                  verification:
                    level.get(`${mint.userId}|${mint.milestoneId}`) ===
                    "replay-verified"
                      ? ("replay-verified" as const)
                      : ("self-reported" as const),
                  wallet: mint.walletAddress,
                },
              ],
        ),
        next,
      };
    },
  };
}

export type PublicMints = ReturnType<typeof createPublicMints>;
