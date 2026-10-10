import { holdsActivePlatformRole } from "@ador/authorization/role-guard";
import type { DatabaseClient } from "@ador/database/connection";
import {
  collectionReviewEvents,
  collectionSubmissions,
} from "@ador/database/schema/collection-submissions";
import { collections } from "@ador/database/schema/collections";
import { resolveSubmissionTransition } from "@ador/shared/collections";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { asc, eq, inArray } from "drizzle-orm";

import type { ReviewRepository } from "../application/submission-repository.ts";
import { isApprovedCreator, lockIdempotencyKey } from "./guards.ts";
import { loadEvents, reviewSubmissionRecord } from "./submission-views.ts";

export function createDrizzleReview(
  database: DatabaseClient,
): ReviewRepository {
  return {
    decide(input) {
      return database.transaction(async (transaction) => {
        await lockIdempotencyKey(transaction, input.idempotencyKey);
        const [row] = await transaction
          .select()
          .from(collectionSubmissions)
          .where(eq(collectionSubmissions.id, input.submissionId))
          .for("update")
          .limit(1);
        if (row === undefined) return { kind: "not-found" };
        const [repeated] = await transaction
          .select()
          .from(collectionReviewEvents)
          .where(
            eq(collectionReviewEvents.idempotencyKey, input.idempotencyKey),
          )
          .limit(1);
        if (repeated !== undefined)
          return repeated.submissionId === row.id &&
            repeated.requestFingerprint === input.requestFingerprint
            ? {
                kind: "replayed",
                submission: reviewSubmissionRecord(
                  row,
                  await loadEvents(transaction, [row.id]),
                ),
              }
            : { kind: "conflict" };
        // Nobody reviews their own collection, and only a reviewer whose role is still active may decide.
        if (row.ownerUserId === input.actorUserId) return { kind: "forbidden" };
        if (
          !(await holdsActivePlatformRole(
            transaction,
            input.actorUserId,
            input.allowedReviewerRoles,
          ))
        )
          return { kind: "forbidden" };
        const nextState = resolveSubmissionTransition(row.state, input.action);
        if (nextState === null)
          return { kind: "invalid-transition", state: row.state };
        // A version cannot become (or return to) approved for a creator who is no longer approved.
        if (
          (input.action === "approve" || input.action === "reinstate") &&
          !(await isApprovedCreator(transaction, row.ownerUserId))
        )
          return { kind: "owner-not-eligible" };
        const [updated] = await transaction
          .update(collectionSubmissions)
          .set({ state: nextState, updatedAt: input.changedAt })
          .where(eq(collectionSubmissions.id, row.id))
          .returning();
        if (updated === undefined)
          throw new Error("Updated submission is missing");
        await transaction.insert(collectionReviewEvents).values({
          action: input.action,
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          createdAt: input.changedAt,
          creatorFeedback: input.creatorFeedback,
          id: input.eventId,
          idempotencyKey: input.idempotencyKey,
          nextState,
          policyVersion: input.policyVersion,
          previousState: row.state,
          privateNotes: input.privateNotes,
          reasonCode: input.reasonCode,
          requestFingerprint: input.requestFingerprint,
          submissionId: row.id,
        });
        return {
          kind: "decided",
          submission: reviewSubmissionRecord(
            updated,
            await loadEvents(transaction, [row.id]),
          ),
        };
      });
    },

    async queue({ limit, states }) {
      const rows = await database
        .select({
          collectionId: collectionSubmissions.collectionId,
          collectionName: collections.name,
          createdAt: collectionSubmissions.createdAt,
          id: collectionSubmissions.id,
          sequence: collectionSubmissions.sequence,
          state: collectionSubmissions.state,
          updatedAt: collectionSubmissions.updatedAt,
        })
        .from(collectionSubmissions)
        .innerJoin(
          collections,
          eq(collections.id, collectionSubmissions.collectionId),
        )
        .where(inArray(collectionSubmissions.state, [...states]))
        // Oldest first: whoever has waited longest is reviewed first. The id (time-ordered) breaks ties,
        // so two changes in the same instant never swap places between reads.
        .orderBy(
          asc(collectionSubmissions.updatedAt),
          asc(collectionSubmissions.id),
        )
        .limit(limit);
      return rows.map((row) => ({
        ...row,
        collectionId: uuidV7Schema.parse(row.collectionId),
        id: uuidV7Schema.parse(row.id),
      }));
    },

    async readForReview(submissionId) {
      const [row] = await database
        .select()
        .from(collectionSubmissions)
        .where(eq(collectionSubmissions.id, submissionId))
        .limit(1);
      return row === undefined
        ? null
        : reviewSubmissionRecord(row, await loadEvents(database, [row.id]));
    },
  };
}
