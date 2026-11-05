import type { SubmissionRecord } from "@frostbite/collections";
import type { CollectionSubmission } from "@frostbite/shared/collections";

// A submission as its creator sees it: the state, the frozen revision and hash, and each decision with
// the feedback written for them. Reviewer identities, reason codes, and private notes never leave staff.
export function presentSubmission(
  record: SubmissionRecord,
): CollectionSubmission {
  return {
    collectionId: record.collectionId,
    collectionRevision: record.collectionRevision,
    createdAt: record.createdAt.toISOString(),
    decisions: record.decisions.map((decision) => ({
      action: decision.action,
      createdAt: decision.createdAt.toISOString(),
      creatorFeedback: decision.creatorFeedback,
      nextState: decision.nextState,
    })),
    id: record.id,
    payloadHash: record.payloadHash,
    sequence: record.sequence,
    state: record.state,
    updatedAt: record.updatedAt.toISOString(),
  };
}
