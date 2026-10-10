import type {
  ActivityPage,
  ReviewQueueRecord,
  ReviewSubmissionRecord,
} from "@ador/collections";
import {
  encodeActivityCursor,
  type ReviewActivityResponse,
  type ReviewQueueItem,
  type ReviewSubmission,
} from "@ador/shared/collections";

export function presentQueueItem(record: ReviewQueueRecord): ReviewQueueItem {
  return {
    collectionId: record.collectionId,
    collectionName: record.collectionName,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    sequence: record.sequence,
    state: record.state,
    updatedAt: record.updatedAt.toISOString(),
  };
}

// Everything staff may see of a submission: the frozen snapshot and every event, including private
// notes and who acted. The creator's own view of the same record is a different, smaller shape.
export function presentReviewSubmission(
  record: ReviewSubmissionRecord,
): ReviewSubmission {
  return {
    collectionId: record.collectionId,
    collectionRevision: record.collectionRevision,
    createdAt: record.createdAt.toISOString(),
    events: record.events.map((event) => ({
      action: event.action,
      actorName: event.actorName,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString(),
      creatorFeedback: event.creatorFeedback,
      nextState: event.nextState,
      previousState: event.previousState,
      privateNotes: event.privateNotes,
      reasonCode: event.reasonCode,
    })),
    id: record.id,
    ownerState: record.ownerState,
    ownerUserId: record.ownerUserId,
    payloadHash: record.payloadHash,
    sequence: record.sequence,
    snapshot: record.snapshot,
    state: record.state,
    updatedAt: record.updatedAt.toISOString(),
  };
}

// One page of the activity log. Private notes and feedback are never in a record of the log, so they
// cannot be copied here; the cursor is encoded for the next, older page.
export function presentActivity(page: ActivityPage): ReviewActivityResponse {
  return {
    items: page.items.map((item) => ({
      action: item.action,
      actorName: item.actorName,
      actorUserId: item.actorUserId,
      collectionId: item.collectionId,
      collectionName: item.collectionName,
      createdAt: item.createdAt.toISOString(),
      eventId: item.eventId,
      nextState: item.nextState,
      previousState: item.previousState,
      reasonCode: item.reasonCode,
      sequence: item.sequence,
      submissionId: item.submissionId,
    })),
    nextCursor:
      page.next === null
        ? null
        : encodeActivityCursor({
            createdAt: page.next.createdAt.toISOString(),
            id: page.next.id,
          }),
  };
}
