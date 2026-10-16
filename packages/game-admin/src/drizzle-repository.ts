import type { DatabaseClient } from "@ador/database/connection";
import { gameAdminSteps } from "@ador/database/schema/game-admin";
import { readTracked, trackedValues } from "@ador/shared/chain";
import { and, eq, inArray, lte, notInArray, sql } from "drizzle-orm";

import type { AdminAction, GameAdminRepository, StoredStep } from "./types.ts";

type Row = typeof gameAdminSteps.$inferSelect;

// States in which the step has not been signed: the wallet can still be asked, and the step can run out of time.
const unsigned = ["constructed", "simulated", "awaiting_signature"] as const;
// A step is over when it took effect or never will.
const settled = [
  "broadcast_rejected",
  "complete",
  "expired",
  "indexed_failure",
] as const;

function toStep(row: Row): StoredStep {
  return {
    ...readTracked(row),
    createdAt: row.createdAt,
    // The column's check constraint admits only the operations of `AdminAction`.
    createdBy: row.createdBy,
    expiresAt: row.expiresAt,
    failureReason: row.failureReason,
    gameId: row.gameId,
    id: row.id,
    milestoneId: row.milestoneId,
    operation: row.operation as AdminAction["operation"],
    signedPayload: row.signedPayload,
    submittedBy: row.submittedBy,
    transactionId: row.transactionId,
    updatedAt: row.updatedAt,
  };
}

export function createDrizzleGameAdminRepository(
  database: DatabaseClient,
  options: { readonly clock: () => Date },
): GameAdminRepository {
  return {
    create: (step) =>
      database.transaction(async (transaction) => {
        const same = and(
          eq(gameAdminSteps.gameId, step.gameId),
          eq(gameAdminSteps.operation, step.operation),
          step.milestoneId === null
            ? sql`${gameAdminSteps.milestoneId} is null`
            : eq(gameAdminSteps.milestoneId, step.milestoneId),
        );
        // One start at a time per game, operation and milestone, so two cannot both add a step.
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`game-admin:${step.gameId}:${step.operation}:${step.milestoneId ?? ""}`}, 0))`,
        );
        const now = options.clock();
        // A step that was never signed and has run out of time is spent, so it does not block a new one.
        await transaction
          .update(gameAdminSteps)
          .set({ state: "expired", updatedAt: now })
          .where(
            and(
              same,
              inArray(gameAdminSteps.state, [...unsigned]),
              lte(gameAdminSteps.expiresAt, now),
            ),
          );
        const [open] = await transaction
          .select()
          .from(gameAdminSteps)
          .where(and(same, notInArray(gameAdminSteps.state, [...settled])));
        if (open !== undefined)
          return { kind: "in-progress", step: toStep(open) } as const;
        // The contract defines a milestone once and never edits it, so a definition that completed stands.
        if (step.operation === "define-milestone") {
          const [done] = await transaction
            .select({ id: gameAdminSteps.id })
            .from(gameAdminSteps)
            .where(and(same, eq(gameAdminSteps.state, "complete")));
          if (done !== undefined) return { kind: "already-defined" } as const;
        }
        const stored: StoredStep = {
          ...step,
          failureReason: null,
          signedPayload: null,
          state: "awaiting_signature",
          submittedBy: null,
          transactionId: null,
          updatedAt: now,
        };
        await transaction.insert(gameAdminSteps).values({
          ...trackedValues(step),
          createdAt: step.createdAt,
          createdBy: step.createdBy,
          expiresAt: step.expiresAt,
          gameId: step.gameId,
          id: step.id,
          milestoneId: step.milestoneId,
          operation: step.operation,
          state: stored.state,
          updatedAt: now,
        });
        return { kind: "created", step: stored } as const;
      }),

    get: async (stepId) => {
      const [row] = await database
        .select()
        .from(gameAdminSteps)
        .where(eq(gameAdminSteps.id, stepId));
      return row === undefined ? null : toStep(row);
    },

    list: async (gameId) =>
      (
        await database
          .select()
          .from(gameAdminSteps)
          .where(eq(gameAdminSteps.gameId, gameId))
          .orderBy(gameAdminSteps.createdAt)
      ).map(toStep),

    update: (stepId, decide) =>
      database.transaction(async (transaction) => {
        const [row] = await transaction
          .select()
          .from(gameAdminSteps)
          .where(eq(gameAdminSteps.id, stepId))
          .for("update");
        if (row === undefined) return null;
        const step = toStep(row);
        const change = decide(step);
        if (change === null) return step;
        const updatedAt = options.clock();
        await transaction
          .update(gameAdminSteps)
          .set({
            failureReason: change.failureReason ?? row.failureReason,
            signedPayload: change.signedPayload ?? row.signedPayload,
            state: change.state,
            submittedBy: change.submittedBy ?? row.submittedBy,
            transactionId: change.transactionId ?? row.transactionId,
            updatedAt,
          })
          .where(eq(gameAdminSteps.id, stepId));
        return {
          ...step,
          failureReason: change.failureReason ?? step.failureReason,
          signedPayload: change.signedPayload ?? step.signedPayload,
          state: change.state,
          submittedBy: change.submittedBy ?? step.submittedBy,
          transactionId: change.transactionId ?? step.transactionId,
          updatedAt,
        };
      }),
  };
}
