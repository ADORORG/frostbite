import { z } from "zod";

import { accountReasonCodeSchema } from "../accounts/contracts.ts";
import { uuidV7TextSchema } from "../identifiers/uuid-v7.ts";

export const collectionReviewPolicyVersion = "collection-review-beta-v1";

// The platform capability that lets a role decide on collection submissions. The authorization policy
// grants it, the HTTP operations require it, and the repository checks the role behind it: one name.
export const collectionReviewCapability = "collection:review";

// One state per submission, never per collection: a collection can have several submissions over
// time (a revision after "changes-requested" is a new submission), and each keeps its own history.
export const submissionStates = [
  "submitted",
  "under-review",
  "approved",
  "changes-requested",
  "rejected",
  "suspended",
  "revoked",
] as const;
export const submissionStateSchema = z.enum(submissionStates);

// `submit` creates a submission (it is not a transition of an existing one); the rest move one.
export const submissionActions = [
  "submit",
  "start-review",
  "approve",
  "request-changes",
  "reject",
  "suspend",
  "reinstate",
  "revoke",
] as const;
export const submissionActionSchema = z.enum(submissionActions);

export const reviewActions = [
  "start-review",
  "approve",
  "request-changes",
  "reject",
  "suspend",
  "reinstate",
  "revoke",
] as const;
export const reviewActionSchema = z.enum(reviewActions);

export type SubmissionState = z.infer<typeof submissionStateSchema>;
export type SubmissionAction = z.infer<typeof submissionActionSchema>;
export type ReviewAction = z.infer<typeof reviewActionSchema>;

const transitions: Readonly<
  Record<
    SubmissionState,
    Readonly<Partial<Record<ReviewAction, SubmissionState>>>
  >
> = {
  approved: { revoke: "revoked", suspend: "suspended" },
  // A creator's revision is a new submission, so this one is finished.
  "changes-requested": {},
  rejected: {},
  revoked: {},
  submitted: { "start-review": "under-review" },
  suspended: { reinstate: "approved", revoke: "revoked" },
  "under-review": {
    approve: "approved",
    "request-changes": "changes-requested",
    reject: "rejected",
  },
};

export function resolveSubmissionTransition(
  state: SubmissionState,
  action: ReviewAction,
): SubmissionState | null {
  return transitions[state][action] ?? null;
}

// States in which a submission is still in play. At most one submission of a collection may be live
// (enforced by a partial unique index), so a creator cannot have two versions under review, and a
// new submission is possible only after the previous one ended in "changes-requested".
export const liveSubmissionStates = [
  "submitted",
  "under-review",
  "approved",
  "suspended",
] as const satisfies readonly SubmissionState[];

export const reviewFieldLimits = Object.freeze({
  creatorFeedback: 2_000,
  privateNotes: 4_000,
});

// Actions that end or withhold something from the creator must say why, in words they will see.
const actionsNeedingFeedback: readonly ReviewAction[] = [
  "request-changes",
  "reject",
  "revoke",
  "suspend",
];

export const reviewDecisionSchema = z
  .object({
    action: reviewActionSchema,
    creatorFeedback: z.string().trim().max(reviewFieldLimits.creatorFeedback),
    privateNotes: z.string().trim().max(reviewFieldLimits.privateNotes),
    reasonCode: accountReasonCodeSchema,
    submissionId: uuidV7TextSchema,
  })
  .strict()
  .refine(
    ({ action, creatorFeedback }) =>
      creatorFeedback !== "" || !actionsNeedingFeedback.includes(action),
    {
      message: "This decision needs feedback for the creator.",
      path: ["creatorFeedback"],
    },
  );

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
