import type { DatabaseClient } from "@frostbite/database/connection";
import {
  gameMilestoneClaims,
  gameMintTotals,
} from "@frostbite/database/schema/game-claims";
import { transactionStates } from "@frostbite/shared/chain";
import { and, eq, inArray, sql } from "drizzle-orm";

import { settledStates } from "./repository.ts";

// What staff see of a game's mints: how many are complete and the platform fees they carried, and how many are still on their way.
export interface GameMintTotals {
  readonly completed: number;
  readonly feesAccruedSats: bigint;
  readonly gameId: string;
  readonly inProgress: number;
}

// One completed mint, newest first.
export interface RecentMint {
  readonly claimId: string;
  readonly completedAt: Date;
  readonly milestoneId: string;
  readonly platformFeeSats: bigint;
  readonly transactionId: string | null;
  readonly userId: string;
  readonly walletAddress: string;
}

// Where the next page of a game's mints starts: after the mint with this completion time and id, in the same order.
export interface MintCursor {
  readonly claimId: string;
  readonly completedAt: Date;
}

// The states of a claim that is neither complete nor over: it has been built and has not yet taken effect or failed.
const onTheirWay = [...transactionStates, "expired"].filter(
  (state) => !(settledStates as ReadonlySet<string>).has(state),
);
const complete = sql`${gameMilestoneClaims.state} = 'complete'`;

// The queries behind the report, apart from running them, so a test can ask the database how it would run each (EXPLAIN) and hold it to
// the tables and indexes made for them (see the claims table's own comment).
export function mintQueries(database: DatabaseClient) {
  return {
    // Completed mints and fees: a row per game from the table the triggers keep, never the claims.
    completed: (gameIds: readonly string[]) =>
      database
        .select()
        .from(gameMintTotals)
        .where(inArray(gameMintTotals.gameId, [...gameIds])),

    // The claims still on their way: only the index entries of those states of the games asked about.
    inProgress: (gameIds: readonly string[]) =>
      database
        .select({
          count: sql<number>`count(*)::int`,
          gameId: gameMilestoneClaims.gameId,
        })
        .from(gameMilestoneClaims)
        .where(
          and(
            inArray(gameMilestoneClaims.gameId, [...gameIds]),
            inArray(gameMilestoneClaims.state, onTheirWay),
          ),
        )
        .groupBy(gameMilestoneClaims.gameId),

    // A page of a game's completed mints in the order the index keeps them, one row past the page to know whether another follows.
    recent: (gameId: string, pageSize: number, after?: MintCursor) =>
      database
        .select({
          claimId: gameMilestoneClaims.id,
          completedAt: gameMilestoneClaims.updatedAt,
          milestoneId: gameMilestoneClaims.milestoneId,
          platformFeeSats: gameMilestoneClaims.platformFeeSats,
          transactionId: gameMilestoneClaims.transactionId,
          userId: gameMilestoneClaims.userId,
          walletAddress: gameMilestoneClaims.walletAddress,
        })
        .from(gameMilestoneClaims)
        .where(
          and(
            eq(gameMilestoneClaims.gameId, gameId),
            complete,
            after === undefined
              ? undefined
              : sql`(${gameMilestoneClaims.updatedAt}, ${gameMilestoneClaims.id}) < (${after.completedAt}, ${after.claimId})`,
          ),
        )
        .orderBy(
          sql`${gameMilestoneClaims.updatedAt} desc nulls last`,
          sql`${gameMilestoneClaims.id} desc nulls last`,
        )
        .limit(pageSize + 1),
  };
}

// Reads mints without any query that grows with how many there are: totals are a row per game, the claims on their way are found by
// their state, and a page of the list costs the page asked for.
export function createMintReport(database: DatabaseClient) {
  const queries = mintQueries(database);
  // The totals of the games asked about, in the order asked, from the two reads: what is complete (a row per game) and what is on its way.
  async function totals(
    gameIds: readonly string[],
  ): Promise<readonly GameMintTotals[]> {
    const [done, waiting] = await Promise.all([
      queries.completed(gameIds),
      queries.inProgress(gameIds),
    ]);
    const doneBy = new Map(done.map((row) => [row.gameId, row]));
    const waitingBy = new Map(waiting.map((row) => [row.gameId, row.count]));
    return gameIds.map((gameId) => ({
      completed: doneBy.get(gameId)?.completed ?? 0,
      feesAccruedSats: doneBy.get(gameId)?.feesSats ?? 0n,
      gameId,
      inProgress: waitingBy.get(gameId) ?? 0,
    }));
  }
  return {
    // The totals of each game asked about, in the order asked; a game with no claims has zeros.
    totalsFor: (
      gameIds: readonly string[],
    ): Promise<readonly GameMintTotals[]> =>
      gameIds.length === 0 ? Promise.resolve([]) : totals(gameIds),

    // A page of a game's completed mints, newest first, and where the next page starts (none at the end).
    async recent(
      gameId: string,
      pageSize: number,
      after?: MintCursor,
    ): Promise<{
      readonly mints: readonly RecentMint[];
      readonly next: MintCursor | null;
    }> {
      const rows = await queries.recent(gameId, pageSize, after);
      const mints = rows.slice(0, pageSize);
      const last = mints.at(-1);
      return {
        mints,
        next:
          rows.length > pageSize && last !== undefined
            ? { claimId: last.claimId, completedAt: last.completedAt }
            : null,
      };
    },
  };
}

export type MintReport = ReturnType<typeof createMintReport>;
