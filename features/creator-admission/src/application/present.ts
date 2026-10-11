import type { createCreatorAdmissionService } from "@ador/creator-admission";
import type {
  CreatorApplicationResponse,
  CreatorReviewDetail,
  CreatorReviewQueueItem,
} from "@ador/shared/creator-admission";

type Service = ReturnType<typeof createCreatorAdmissionService>;
type ApplicationView = NonNullable<Awaited<ReturnType<Service["findMine"]>>>;

// The wire form of an application: dates travel as text. The API and the server-rendered page both show an
// application in this form, so it is made in one place.
export function presentApplication(
  application: ApplicationView,
): CreatorApplicationResponse["application"] {
  const { feedback } = application;
  return {
    ...application,
    feedback:
      feedback === null
        ? null
        : { createdAt: feedback.createdAt.toISOString(), text: feedback.text },
  };
}

type QueueRow = Awaited<ReturnType<Service["reviewQueue"]>>["items"][number];
type DetailRecord = NonNullable<Awaited<ReturnType<Service["readForReview"]>>>;

// One row of the review queue, in its wire form. The sort key stays inside; the cursor carries it.
export function presentQueueItem(row: QueueRow): CreatorReviewQueueItem {
  return {
    applicationId: row.applicationId,
    displayName: row.displayName,
    state: row.state,
    submissionNumber: row.submissionNumber,
    submittedAt: row.submittedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function presentReviewDetail(record: DetailRecord): CreatorReviewDetail {
  return {
    applicationId: record.applicationId,
    events: record.events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    snapshot: record.snapshot,
    state: record.state,
    submissionNumber: record.submissionNumber,
    submittedAt: record.submittedAt.toISOString(),
  };
}
