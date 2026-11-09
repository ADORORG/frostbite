import type { DatabaseClient } from "@frostbite/database/connection";
import { gameAdminSteps } from "@frostbite/database/schema/game-admin";
import {
  readTracked,
  sentAtAfter,
  trackedValues,
  type UnsignedTransaction,
} from "@frostbite/shared/chain";
import { and, eq, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { writeRecording } from "@frostbite/database/game-contracts";
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
    broadcastAt: row.broadcastAt,
    createdAt: row.createdAt,
    // The column's check constraint admits only the operations of `AdminAction`.
    createdBy: row.createdBy,
    expiresAt: row.expiresAt,
    failureReason: row.failureReason,
    createdContracts: row.createdContracts,
    gameId: row.gameId,
    id: row.id,
    milestoneId: row.milestoneId,
    operation: row.operation as AdminAction["operation"],
    recordedBy: row.recordedBy,
    signedPayload: row.signedPayload,
    submittedBy: row.submittedBy,
    templateRef: row.templateRef,
    transactionId: row.transactionId,
    updatedAt: row.updatedAt,
  };
}

// The rows of the same kind of step on the same subject: one game's operation on a milestone, or one template's publication.
function sameSubject(step: {
  readonly gameId: string | null;
  readonly milestoneId: string | null;
  readonly operation: string;
  readonly templateRef: string | null;
}) {
  const matches = (column: AnyPgColumn, value: string | null) =>
    value === null ? sql`${column} is null` : eq(column, value);
  return and(
    matches(gameAdminSteps.gameId, step.gameId),
    eq(gameAdminSteps.operation, step.operation),
    matches(gameAdminSteps.milestoneId, step.milestoneId),
    matches(gameAdminSteps.templateRef, step.templateRef),
  );
}

// One lock name per subject, so two starts for it cannot both add a step.
const lockName = (step: {
  readonly gameId: string | null;
  readonly milestoneId: string | null;
  readonly operation: string;
  readonly templateRef: string | null;
}) =>
  `game-admin:${step.gameId ?? ""}:${step.operation}:${step.milestoneId ?? ""}:${step.templateRef ?? ""}`;

// The drawing a step carries, by its hash; none for a step that carries no drawing.
const drawingOf = (step: { readonly unsigned: UnsignedTransaction }) =>
  step.unsigned.summary.drawing?.sha256 ?? null;

export function createDrizzleGameAdminRepository(
  database: DatabaseClient,
  options: { readonly clock: () => Date },
): GameAdminRepository {
  return {
    create: (step) =>
      database.transaction(async (transaction) => {
        const same = sameSubject(step);
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${lockName(step)}, 0))`,
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
        if (open !== undefined) {
          const waiting = toStep(open);
          // A step still waiting for a signature was built for the drawing it was asked with. A request for another drawing (or none)
          // is not that step: it takes its place, so what staff type last is what goes on the chain. A step already signed or sent
          // cannot be changed, so it is returned as it is.
          const replaced =
            (unsigned as readonly string[]).includes(waiting.state) &&
            drawingOf(waiting) !== drawingOf(step);
          if (!replaced) return { kind: "in-progress", step: waiting } as const;
          await transaction
            .update(gameAdminSteps)
            .set({ state: "expired", updatedAt: now })
            .where(eq(gameAdminSteps.id, open.id));
        }
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
          broadcastAt: null,
          createdContracts: null,
          failureReason: null,
          recordedBy: null,
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
          templateRef: step.templateRef,
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
          .where(
            gameId === null
              ? sql`${gameAdminSteps.gameId} is null`
              : eq(gameAdminSteps.gameId, gameId),
          )
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
        // A refused step holds no transaction (the table says so): one refused after it had been sent without the network being seen to
        // hold it lets go of the id it was following, since there is nothing on the network to follow.
        const refused = change.state === "broadcast_rejected";
        const broadcastAt = refused
          ? null
          : sentAtAfter(step.broadcastAt, change, updatedAt);
        const transactionId = refused
          ? null
          : (change.transactionId ?? row.transactionId);
        await transaction
          .update(gameAdminSteps)
          .set({
            broadcastAt,
            createdContracts: change.createdContracts
              ? [...change.createdContracts]
              : row.createdContracts,
            failureReason:
              change.failureReason === undefined
                ? row.failureReason
                : change.failureReason,
            recordedBy: change.recordedBy ?? row.recordedBy,
            signedPayload: change.signedPayload ?? row.signedPayload,
            state: change.state,
            submittedBy: change.submittedBy ?? row.submittedBy,
            transactionId,
            updatedAt,
          })
          .where(eq(gameAdminSteps.id, stepId));
        if (change.record !== undefined)
          await writeRecording(transaction, step, change.record);
        return {
          ...step,
          broadcastAt,
          createdContracts: change.createdContracts ?? step.createdContracts,
          failureReason:
            change.failureReason === undefined
              ? step.failureReason
              : change.failureReason,
          recordedBy: change.recordedBy ?? step.recordedBy,
          signedPayload: change.signedPayload ?? step.signedPayload,
          state: change.state,
          submittedBy: change.submittedBy ?? step.submittedBy,
          transactionId,
          updatedAt,
        };
      }),
  };
}
