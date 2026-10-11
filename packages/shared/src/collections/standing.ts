import type { SubmissionState } from "./review-state.ts";

// Where a collection stands from its creator's point of view, from the state of its latest submission
// (none yet means it is still a draft). Both the studio's filters and its wording come from here, so a
// collection is never called two different things on two pages. Standings follow what the creator can do:
// "needs-changes" is the only one they can act on (the server accepts a new submission only after changes
// were requested); "paused" will come back if staff reinstate it; "ended" is final (rejected or revoked).
export const collectionStandings = [
  "draft",
  "in-review",
  "needs-changes",
  "approved",
  "paused",
  "ended",
] as const;
export type CollectionStanding = (typeof collectionStandings)[number];

export const collectionStandingLabels: Readonly<
  Record<CollectionStanding, string>
> = {
  approved: "Approved",
  draft: "Drafts",
  ended: "Ended",
  "in-review": "In review",
  "needs-changes": "Needs changes",
  paused: "Paused",
};

const standingOfState: Readonly<Record<SubmissionState, CollectionStanding>> = {
  approved: "approved",
  "changes-requested": "needs-changes",
  rejected: "ended",
  revoked: "ended",
  submitted: "in-review",
  suspended: "paused",
  "under-review": "in-review",
};

export function standingOf(state: SubmissionState | null): CollectionStanding {
  return state === null ? "draft" : standingOfState[state];
}
