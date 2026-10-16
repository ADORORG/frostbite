import type { DatabaseClient } from "@ador/database/connection";
import { gameMilestoneClaims } from "@ador/database/schema/game-claims";
import {
  addressSchema,
  chainFamilyIdSchema,
  chainRefSchema,
  contractRefSchema,
  type TransactionSummary,
  type UnsignedTransaction,
} from "@ador/shared/chain";
import { and, eq, inArray, lte, notInArray, sql } from "drizzle-orm";

import {
  settledStates,
  type ClaimState,
  type GameClaimRepository,
  type StoredClaim,
} from "./repository.ts";
import { decodeSummary, encodeSummary } from "./summary-codec.ts";

type Row = typeof gameMilestoneClaims.$inferSelect;

// States in which the claim has not been signed: the wallet can still be asked, and the claim can run out of time.
const unsigned = ["constructed", "simulated", "awaiting_signature"] as const;
const settledList = [...settledStates];

function toClaim(row: Row): StoredClaim {
  const summary: TransactionSummary = decodeSummary(row.summary);
  const chain = chainRefSchema.parse(row.chain);
  const transaction: UnsignedTransaction = {
    chain,
    family: chainFamilyIdSchema.parse(row.unsignedFamily),
    format: row.unsignedFormat,
    payload: row.unsignedPayload,
    summary,
  };
  return {
    chain,
    contract: contractRefSchema.parse({
      chain,
      family: row.contractFamily,
      id: row.contractId,
    }),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    expectedClaims: row.expectedClaims,
    failureReason: row.failureReason,
    gameId: row.gameId,
    id: row.id,
    milestoneId: row.milestoneId,
    signedPayload: row.signedPayload,
    // The column's check constraint admits only the states of `ClaimState`.
    state: row.state as ClaimState,
    transactionId: row.transactionId,
    unsigned: transaction,
    updatedAt: row.updatedAt,
    userId: row.userId,
    wallet: addressSchema.parse({ chain, value: row.walletAddress }),
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
          expectedClaims,
          failureReason: null,
          signedPayload: null,
          state: "awaiting_signature",
          transactionId: null,
          updatedAt: now,
        };
        await transaction.insert(gameMilestoneClaims).values({
          chain: claim.chain,
          contractFamily: claim.contract.family,
          contractId: claim.contract.id,
          createdAt: claim.createdAt,
          expectedClaims,
          expiresAt: claim.expiresAt,
          gameId: claim.gameId,
          id: claim.id,
          milestoneId: claim.milestoneId,
          state: stored.state,
          summary: encodeSummary(claim.unsigned.summary),
          unsignedFamily: claim.unsigned.family,
          unsignedFormat: claim.unsigned.format,
          unsignedPayload: claim.unsigned.payload,
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
        await transaction
          .update(gameMilestoneClaims)
          .set({
            failureReason: change.failureReason ?? row.failureReason,
            signedPayload: change.signedPayload ?? row.signedPayload,
            state: change.state,
            transactionId: change.transactionId ?? row.transactionId,
            updatedAt,
          })
          .where(eq(gameMilestoneClaims.id, claimId));
        return {
          ...claim,
          failureReason: change.failureReason ?? claim.failureReason,
          signedPayload: change.signedPayload ?? claim.signedPayload,
          state: change.state,
          transactionId: change.transactionId ?? claim.transactionId,
          updatedAt,
        };
      }),
  };
}
