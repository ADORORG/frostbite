import type { DatabaseClient } from "@frostbite/database/connection";
import {
  gameMilestoneClaims,
  gameMilestoneMintTotals,
} from "@frostbite/database/schema/game-claims";
import {
  addressSchema,
  readTracked,
  sentAtAfter,
  trackedValues,
} from "@frostbite/shared/chain";
import { and, desc, eq, inArray, lte, notInArray, sql } from "drizzle-orm";

import {
  settledStates,
  type GameClaimRepository,
  type StoredClaim,
} from "./repository.ts";

type Row = typeof gameMilestoneClaims.$inferSelect;

// States in which the claim has not been signed: the wallet can still be asked, and the claim can run out of time.
const unsigned = ["constructed", "simulated", "awaiting_signature"] as const;
const settledList = [...settledStates];

function toClaim(row: Row): StoredClaim {
  const tracked = readTracked(row);
  return {
    ...tracked,
    broadcastAt: row.broadcastAt,
    collectibleId: row.collectibleId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    expectedClaims: row.expectedClaims,
    failureReason: row.failureReason,
    gameId: row.gameId,
    id: row.id,
    milestoneId: row.milestoneId,
    platformFeeSats: row.platformFeeSats,
    signedPayload: row.signedPayload,
    transactionId: row.transactionId,
    updatedAt: row.updatedAt,
    userId: row.userId,
    wallet: addressSchema.parse({
      chain: tracked.chain,
      value: row.walletAddress,
    }),
  };
}

export interface DrizzleGameClaimOptions {
  readonly clock: () => Date;
}

export function createDrizzleGameClaimRepository(
  database: DatabaseClient,
  options: DrizzleGameClaimOptions,
): GameClaimRepository {
  return {
    create: (claim, { limit }) =>
      database.transaction(async (transaction) => {
        const mine = and(
          eq(gameMilestoneClaims.userId, claim.userId),
          eq(gameMilestoneClaims.gameId, claim.gameId),
          eq(gameMilestoneClaims.milestoneId, claim.milestoneId),
        );
        // One start at a time per player and milestone, so two cannot both find room or both add a claim.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`game-claims:${claim.userId}:${claim.gameId}:${claim.milestoneId}`}, 0))`,
        );
        const now = options.clock();
        // A claim that was never signed and has run out of time is spent, so it neither blocks a new one nor counts.
        await transaction
          .update(gameMilestoneClaims)
          .set({ state: "expired", updatedAt: now })
          .where(
            and(
              mine,
              inArray(gameMilestoneClaims.state, [...unsigned]),
              lte(gameMilestoneClaims.expiresAt, now),
            ),
          );
        const [open] = await transaction
          .select()
          .from(gameMilestoneClaims)
          .where(and(mine, notInArray(gameMilestoneClaims.state, settledList)));
        if (open !== undefined)
          return { claim: toClaim(open), kind: "in-progress" } as const;
        const completed = await transaction
          .select()
          .from(gameMilestoneClaims)
          .where(and(mine, eq(gameMilestoneClaims.state, "complete")));
        if (completed.length >= limit)
          return { kind: "limit-reached" } as const;
        // What the chain must show for this wallet: the claims it has already completed here, and this one.
        const expectedClaims =
          completed.filter(
            ({ walletAddress }) => walletAddress === claim.wallet.value,
          ).length + 1;
        const stored: StoredClaim = {
          ...claim,
          broadcastAt: null,
          collectibleId: null,
          expectedClaims,
          failureReason: null,
          signedPayload: null,
          state: "awaiting_signature",
          transactionId: null,
          updatedAt: now,
        };
        await transaction.insert(gameMilestoneClaims).values({
          ...trackedValues(claim),
          createdAt: claim.createdAt,
          expectedClaims,
          expiresAt: claim.expiresAt,
          gameId: claim.gameId,
          id: claim.id,
          milestoneId: claim.milestoneId,
          platformFeeSats: claim.platformFeeSats,
          state: stored.state,
          updatedAt: now,
          userId: claim.userId,
          walletAddress: claim.wallet.value,
        });
        return { claim: stored, kind: "created" } as const;
      }),

    get: async (userId, claimId) => {
      const [row] = await database
        .select()
        .from(gameMilestoneClaims)
        .where(
          and(
            eq(gameMilestoneClaims.id, claimId),
            eq(gameMilestoneClaims.userId, userId),
          ),
        );
      return row === undefined ? null : toClaim(row);
    },

    list: async (userId, gameId) =>
      (
        await database
          .select()
          .from(gameMilestoneClaims)
          .where(
            and(
              eq(gameMilestoneClaims.userId, userId),
              eq(gameMilestoneClaims.gameId, gameId),
            ),
          )
          .orderBy(gameMilestoneClaims.createdAt)
      ).map(toClaim),

    completeCounts: async (gameId) =>
      new Map(
        (
          await database
            .select({
              completed: gameMilestoneMintTotals.completed,
              milestoneId: gameMilestoneMintTotals.milestoneId,
            })
            .from(gameMilestoneMintTotals)
            .where(eq(gameMilestoneMintTotals.gameId, gameId))
        ).map(({ completed, milestoneId }) => [milestoneId, completed]),
      ),

    listComplete: async (userId) =>
      (
        await database
          .select()
          .from(gameMilestoneClaims)
          .where(
            and(
              eq(gameMilestoneClaims.userId, userId),
              eq(gameMilestoneClaims.state, "complete"),
            ),
          )
          .orderBy(desc(gameMilestoneClaims.updatedAt))
      ).map(toClaim),

    update: (userId, claimId, decide) =>
      database.transaction(async (transaction) => {
        const [row] = await transaction
          .select()
          .from(gameMilestoneClaims)
          .where(
            and(
              eq(gameMilestoneClaims.id, claimId),
              eq(gameMilestoneClaims.userId, userId),
            ),
          )
          .for("update");
        // Not the player's claim, or not a claim: the same answer, so a claim id says nothing to others.
        if (row === undefined) return null;
        const claim = toClaim(row);
        const change = decide(claim);
        if (change === null) return claim;
        const updatedAt = options.clock();
        const broadcastAt = sentAtAfter(claim.broadcastAt, change, updatedAt);
        await transaction
          .update(gameMilestoneClaims)
          .set({
            broadcastAt,
            collectibleId: change.collectibleId ?? row.collectibleId,
            failureReason: change.failureReason ?? row.failureReason,
            signedPayload: change.signedPayload ?? row.signedPayload,
            state: change.state,
            transactionId: change.transactionId ?? row.transactionId,
            updatedAt,
          })
          .where(eq(gameMilestoneClaims.id, claimId));
        return {
          ...claim,
          broadcastAt,
          failureReason: change.failureReason ?? claim.failureReason,
          signedPayload: change.signedPayload ?? claim.signedPayload,
          state: change.state,
          transactionId: change.transactionId ?? claim.transactionId,
          updatedAt,
        };
      }),
  };
}
