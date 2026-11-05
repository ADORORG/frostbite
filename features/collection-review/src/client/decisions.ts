import {
  resolveSubmissionTransition,
  reviewActions,
  reviewActionsNeedingFeedback,
  reviewDecisionSchema,
  reviewFieldLimits,
  type ReviewAction,
  type ReviewDecision,
  type SubmissionState,
} from "@frostbite/shared/collections";

// The audit reason recorded with each action. A decision is judged on its feedback; the code only
// groups decisions for later reporting, so the reviewer is not asked to invent one.
export const reasonCodes: Readonly<Record<ReviewAction, string>> = {
  approve: "reviewer-approved",
  reinstate: "reviewer-reinstated",
  reject: "reviewer-rejected",
  "request-changes": "reviewer-requested-changes",
  revoke: "reviewer-revoked",
  "start-review": "reviewer-started-review",
  suspend: "reviewer-suspended",
};

// Rejecting or revoking cannot be undone, so the reviewer confirms before it is recorded.
export const confirmedActions: readonly ReviewAction[] = ["reject", "revoke"];

// The moves the state machine allows from this state, in the order a reviewer works through them.
export function availableActions(state: SubmissionState): ReviewAction[] {
  return reviewActions.filter(
    (action) => resolveSubmissionTransition(state, action) !== null,
  );
}

export const needsFeedback = (action: ReviewAction): boolean =>
  reviewActionsNeedingFeedback.includes(action);

export interface DecisionForm {
  readonly action: ReviewAction | null;
  readonly creatorFeedback: string;
  readonly privateNotes: string;
}

export const emptyDecisionForm: DecisionForm = {
  action: null,
  creatorFeedback: "",
  privateNotes: "",
};

export interface DecisionErrors {
  readonly action?: string;
  readonly creatorFeedback?: string;
  readonly privateNotes?: string;
}

export type DecisionResult =
  | { readonly decision: ReviewDecision; readonly ok: true }
  | { readonly errors: DecisionErrors; readonly ok: false };

// Validates with the same schema the server uses and says which field is wrong, in words. The server
// stays the authority; this only saves a round trip.
export function parseDecision(
  submissionId: string,
  form: DecisionForm,
): DecisionResult {
  if (form.action === null)
    return { errors: { action: "Choose what to do." }, ok: false };
  const parsed = reviewDecisionSchema.safeParse({
    action: form.action,
    creatorFeedback: form.creatorFeedback,
    privateNotes: form.privateNotes,
    reasonCode: reasonCodes[form.action],
    submissionId,
  });
  if (parsed.success) return { decision: parsed.data, ok: true };
  const failed = (field: string) =>
    parsed.error.issues.some(({ path }) => path[0] === field);
  return {
    errors: {
      ...(failed("creatorFeedback")
        ? {
            creatorFeedback: needsFeedback(form.action)
              ? `Write what the creator should know, up to ${reviewFieldLimits.creatorFeedback.toLocaleString("en-US")} characters.`
              : `Keep this to ${reviewFieldLimits.creatorFeedback.toLocaleString("en-US")} characters.`,
          }
        : {}),
      ...(failed("privateNotes")
        ? {
            privateNotes: `Keep notes to ${reviewFieldLimits.privateNotes.toLocaleString("en-US")} characters.`,
          }
        : {}),
    },
    ok: false,
  };
}
