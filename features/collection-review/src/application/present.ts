import type {
  ReviewQueueRecord,
  ReviewSubmissionRecord,
} from "@ador/collections";
import type {
  ReviewQueueItem,
  ReviewSubmission,
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
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString(),
      creatorFeedback: event.creatorFeedback,
      nextState: event.nextState,
      previousState: event.previousState,
      privateNotes: event.privateNotes,
      reasonCode: event.reasonCode,
    })),
    id: record.id,
    ownerUserId: record.ownerUserId,
    payloadHash: record.payloadHash,
    sequence: record.sequence,
    snapshot: record.snapshot,
    state: record.state,
    updatedAt: record.updatedAt.toISOString(),
  };
}
