import type {
  CreatorReviewDetail,
  CreatorReviewQueueItem,
  CreatorReviewQueueResponse,
} from "@frostbite/shared/creator-admission";
import { createUuidV7 } from "@frostbite/shared/identifiers";

export const emptyCounts: CreatorReviewQueueResponse["counts"] = {
  active: 0,
  all: 0,
  finished: 0,
  "needs-review": 0,
};

export function queueItem(
  overrides: Partial<CreatorReviewQueueItem> = {},
): CreatorReviewQueueItem {
  return {
    applicationId: createUuidV7(),
    displayName: "Ada Maker",
    state: "submitted",
    submissionNumber: 1,
    submittedAt: "2026-10-10T12:30:00.000Z",
    updatedAt: "2026-10-10T12:30:00.000Z",
    ...overrides,
  };
}

export function queuePage(
  items: readonly CreatorReviewQueueItem[],
  nextCursor: string | null = null,
): CreatorReviewQueueResponse {
  return {
    counts: { ...emptyCounts, all: items.length, "needs-review": items.length },
    items: [...items],
    nextCursor,
  };
}

export function detail(
  overrides: Partial<CreatorReviewDetail> = {},
): CreatorReviewDetail {
  return {
    applicationId: createUuidV7(),
    events: [
      {
        action: "submit",
        actorName: "Ada Maker",
        createdAt: "2026-10-10T12:30:00.000Z",
        creatorFeedback: "",
        nextState: "submitted",
        previousState: "draft",
        privateNotes: "",
        reasonCode: "applicant-submitted",
      },
      {
        action: "request-changes",
        actorName: "Rae Reviewer",
        createdAt: "2026-10-11T08:05:00.000Z",
        creatorFeedback: "Add a portfolio link.",
        nextState: "changes-requested",
        previousState: "under-review",
        privateNotes: "Looks thin.",
        reasonCode: "needs-more-evidence",
      },
    ],
    snapshot: {
      contentDeclarationAccepted: true,
      displayName: "Ada Maker",
      expectedLaunchSize: "Small",
      expectedLaunchTiming: "After review",
      jurisdictionAcknowledged: true,
      portfolioLinks: [],
      projectSummary: "Pixel games.",
      provenanceDeclarationAccepted: true,
      rightsDeclarationAccepted: true,
    },
    state: "submitted",
    submissionNumber: 1,
    submittedAt: "2026-10-10T12:30:00.000Z",
    ...overrides,
  };
}
