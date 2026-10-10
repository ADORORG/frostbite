import {
  reviewActionLabels,
  reviewFieldLimits,
  type ReviewAction,
  type SubmissionState,
} from "@ador/shared/collections";
import { ArcadeActionButton, ArcadeTextField } from "@repo/ui/arcade";
import { useId, useState } from "react";

import {
  availableActions,
  confirmedActions,
  emptyDecisionForm,
  needsFeedback,
  type DecisionErrors,
  type DecisionForm as Form,
} from "../../client/decisions.ts";

// The decision a reviewer can record from where the submission stands: only the moves the state
// machine allows, the words the creator will read, and private notes for staff. Rejecting or revoking
// asks for a second click, because it cannot be undone.
export function DecisionForm({
  busy,
  errors,
  onSubmit,
  state,
}: {
  readonly busy: boolean;
  readonly errors: DecisionErrors;
  readonly onSubmit: (form: Form) => Promise<boolean>;
  readonly state: SubmissionState;
}) {
  const group = useId();
  const [form, setForm] = useState<Form>(emptyDecisionForm);
  const [confirming, setConfirming] = useState(false);
  const actions = availableActions(state);
  if (actions.length === 0)
    return <p>No further decisions are possible on this submission.</p>;
  const change = (changes: Partial<Form>) => {
    setConfirming(false);
    setForm({ ...form, ...changes });
  };
  const chosen: ReviewAction | null = form.action;
  const needsConfirmation =
    chosen !== null && confirmedActions.includes(chosen);

  async function record() {
    if (needsConfirmation && !confirming) {
      setConfirming(true);
      return;
    }
    if (await onSubmit(form)) {
      setConfirming(false);
      setForm(emptyDecisionForm);
    }
  }

  return (
    <section aria-label="Decision" className="arcade-form">
      <h3>Decision</h3>
      <fieldset className="arcade-choice">
        <legend>What to do</legend>
        {actions.map((action) => (
          <label key={action}>
            <input
              checked={chosen === action}
              disabled={busy}
              name={group}
              onChange={() => change({ action })}
              type="radio"
            />
            {reviewActionLabels[action]}
          </label>
        ))}
        {errors.action === undefined ? null : (
          <p role="alert">{errors.action}</p>
        )}
      </fieldset>
      <ArcadeTextField
        disabled={busy}
        error={errors.creatorFeedback ?? null}
        hint={
          chosen !== null && needsFeedback(chosen)
            ? "Required. The creator will read this."
            : "Optional. The creator will read this."
        }
        label="Feedback for the creator"
        maxLength={reviewFieldLimits.creatorFeedback}
        multiline
        onChange={(creatorFeedback) => change({ creatorFeedback })}
        value={form.creatorFeedback}
      />
      <ArcadeTextField
        disabled={busy}
        error={errors.privateNotes ?? null}
        hint="Only staff can see this."
        label="Private notes"
        maxLength={reviewFieldLimits.privateNotes}
        multiline
        onChange={(privateNotes) => change({ privateNotes })}
        value={form.privateNotes}
      />
      <div className="arcade-actions">
        <ArcadeActionButton
          disabled={busy}
          onClick={() => void record()}
          tone={needsConfirmation ? "red" : "mint"}
        >
          {needsConfirmation && confirming && chosen !== null
            ? `Confirm: ${reviewActionLabels[chosen].toLowerCase()}`
            : "Record decision"}
        </ArcadeActionButton>
        {confirming ? (
          <ArcadeActionButton onClick={() => setConfirming(false)} tone="pink">
            Cancel
          </ArcadeActionButton>
        ) : null}
      </div>
    </section>
  );
}
