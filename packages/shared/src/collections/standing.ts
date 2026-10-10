import type { SubmissionState } from "./review-state.ts";

// Where a collection stands from its creator's point of view, from the state of its latest submission
// (none yet means it is still a draft). Both the studio's filters and its wording come from here, so a
// collection is never called two different things on two pages.
export const collectionStandings = [
  "draft",
  "in-review",
  "needs-changes",
  "approved",
  "closed",
] as const;
export type CollectionStanding = (typeof collectionStandings)[number];

export const collectionStandingLabels: Readonly<
  Record<CollectionStanding, string>
> = {
  approved: "Approved",
  closed: "Closed",
  draft: "Drafts",
  "in-review": "In review",
  "needs-changes": "Needs changes",
};

const standingOfState: Readonly<Record<SubmissionState, CollectionStanding>> = {
  approved: "approved",
  "changes-requested": "needs-changes",
  rejected: "closed",
  revoked: "closed",
  submitted: "in-review",
  suspended: "closed",
  "under-review": "in-review",
};

export function standingOf(state: SubmissionState | null): CollectionStanding {
  return state === null ? "draft" : standingOfState[state];
}
