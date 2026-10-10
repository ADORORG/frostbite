import type { DatabaseClient } from "@ador/database/connection";
import {
  collectionReviewEvents,
  type CollectionReviewEventRow,
  type CollectionSubmissionRow,
} from "@ador/database/schema/collection-submissions";
import type { CreatorApplicationState } from "@ador/shared/creator-admission";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { authUsers } from "@ador/database/schema/auth";
import { creatorApplications } from "@ador/database/schema/creator-admission";
import { asc, eq, inArray } from "drizzle-orm";

import type {
  ReviewEventRecord,
  ReviewSubmissionRecord,
  SubmissionDecisionRecord,
  SubmissionRecord,
} from "../application/submission-repository.ts";

type Reader = Pick<DatabaseClient, "select">;

// An event with the display name of whoever acted, for staff views.
export type EventWithActor = CollectionReviewEventRow & {
  readonly actorName: string;
};

export async function loadEvents(
  database: Reader,
  submissionIds: readonly string[],
): Promise<readonly EventWithActor[]> {
  if (submissionIds.length === 0) return [];
  const rows = await database
    .select({ actorName: authUsers.name, event: collectionReviewEvents })
    .from(collectionReviewEvents)
    .innerJoin(authUsers, eq(authUsers.id, collectionReviewEvents.actorUserId))
    .where(inArray(collectionReviewEvents.submissionId, [...submissionIds]))
    // The id (time-ordered) breaks ties, so events written in the same instant keep their order.
    .orderBy(
      asc(collectionReviewEvents.createdAt),
      asc(collectionReviewEvents.id),
    );
  return rows.map(({ actorName, event }) => ({ ...event, actorName }));
}

// The creator's standing now, or null if they never applied.
export async function loadOwnerState(
  database: Reader,
  ownerUserId: string,
): Promise<CreatorApplicationState | null> {
  const [application] = await database
    .select({ state: creatorApplications.state })
    .from(creatorApplications)
    .where(eq(creatorApplications.applicantUserId, ownerUserId))
    .limit(1);
  return application?.state ?? null;
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

function reviewEventOf(event: EventWithActor): ReviewEventRecord {
  return {
    ...decisionOf(event),
    actorName: event.actorName,
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
  events: readonly EventWithActor[],
  ownerState: CreatorApplicationState | null,
): ReviewSubmissionRecord {
  return {
    ...submissionRecord(row, events),
    events: events
      .filter(({ submissionId }) => submissionId === row.id)
      .map(reviewEventOf),
    ownerState,
    snapshot: row.snapshot,
  };
}
