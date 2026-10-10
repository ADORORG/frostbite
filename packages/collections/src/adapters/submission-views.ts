import type { DatabaseClient } from "@ador/database/connection";
import {
  collectionReviewEvents,
  type CollectionReviewEventRow,
  type CollectionSubmissionRow,
} from "@ador/database/schema/collection-submissions";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { asc, inArray } from "drizzle-orm";

import type {
  ReviewEventRecord,
  ReviewSubmissionRecord,
  SubmissionDecisionRecord,
  SubmissionRecord,
} from "../application/submission-repository.ts";

type Reader = Pick<DatabaseClient, "select">;

export async function loadEvents(
  database: Reader,
  submissionIds: readonly string[],
): Promise<readonly CollectionReviewEventRow[]> {
  if (submissionIds.length === 0) return [];
  return (
    database
      .select()
      .from(collectionReviewEvents)
      .where(inArray(collectionReviewEvents.submissionId, [...submissionIds]))
      // The id (time-ordered) breaks ties, so events written in the same instant keep their order.
      .orderBy(
        asc(collectionReviewEvents.createdAt),
        asc(collectionReviewEvents.id),
      )
  );
}

// The creator sees every decision made on a submission and the feedback written for them. The
// `submit` event is the creator's own act and is not a decision.
function decisionOf(event: CollectionReviewEventRow): SubmissionDecisionRecord {
  return {
    action: event.action,
    createdAt: event.createdAt,
    creatorFeedback: event.creatorFeedback,
    nextState: event.nextState,
  };
}

function reviewEventOf(event: CollectionReviewEventRow): ReviewEventRecord {
  return {
    ...decisionOf(event),
    actorUserId: uuidV7Schema.parse(event.actorUserId),
    previousState: event.previousState,
    privateNotes: event.privateNotes,
    reasonCode: event.reasonCode,
  };
}

export function submissionRecord(
  row: CollectionSubmissionRow,
  events: readonly CollectionReviewEventRow[],
): SubmissionRecord {
  return {
    collectionId: uuidV7Schema.parse(row.collectionId),
    collectionRevision: row.collectionRevision,
    createdAt: row.createdAt,
    decisions: events
      .filter(
        ({ action, submissionId }) =>
          submissionId === row.id && action !== "submit",
      )
      .map(decisionOf),
    id: uuidV7Schema.parse(row.id),
    ownerUserId: uuidV7Schema.parse(row.ownerUserId),
    payloadHash: row.payloadHash,
    sequence: row.sequence,
    state: row.state,
    updatedAt: row.updatedAt,
  };
}

export function reviewSubmissionRecord(
  row: CollectionSubmissionRow,
  events: readonly CollectionReviewEventRow[],
): ReviewSubmissionRecord {
  return {
    ...submissionRecord(row, events),
    events: events
      .filter(({ submissionId }) => submissionId === row.id)
      .map(reviewEventOf),
    snapshot: row.snapshot,
  };
}
