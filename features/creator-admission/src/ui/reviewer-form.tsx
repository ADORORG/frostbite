"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import {
  creatorApplicationRoutes,
  creatorReviewActionLabels,
  creatorReviewActions,
  creatorReviewReasonCodes,
  resolveCreatorAdmissionTransition,
  type CreatorApplicationState,
  type CreatorReviewAction,
} from "@ador/shared/creator-admission";
import { ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import {
  AdmissionField,
  sendCreatorAdmissionRequest,
} from "./form-helpers.tsx";

// The decision on one application. Only what the application's state allows is offered, so a reviewer
// cannot pick a move the server would refuse, and an application that can go no further says so. The
// reason code starts as the usual one for the move and can be changed.
export function ReviewerForm({
  applicationId,
  onDecided,
  state,
}: {
  readonly applicationId: string;
  // Called after a decision was recorded, so the page can read the application again.
  readonly onDecided: () => void;
  readonly state: CreatorApplicationState;
}) {
  const allowed = creatorReviewActions.filter(
    (action) => resolveCreatorAdmissionTransition(state, action) !== null,
  );
  const [chosen, setChosen] = useState<CreatorReviewAction | null>(
    allowed[0] ?? null,
  );
  const [working, setWorking] = useState(false);
  const requestPending = useRef(false);
  const [message, setMessage] = useState(
    "Reviewer authority is rechecked when each decision executes.",
  );
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setWorking(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await sendCreatorAdmissionRequest(
        creatorApplicationRoutes.review,
        {
          action: data.get("action"),
          applicationId,
          creatorFeedback: data.get("creatorFeedback"),
          evidenceReferences: data.get("evidenceReference")
            ? [data.get("evidenceReference")]
            : [],
          privateNotes: data.get("privateNotes"),
          reasonCode: data.get("reasonCode"),
        },
      );
      setMessage(`Decision recorded. State: ${result.application.state}.`);
      onDecided();
    } catch {
      setMessage(
        "Decision was not recorded. Check authority, application state, verified contact, and input.",
      );
    } finally {
      requestPending.current = false;
      setWorking(false);
    }
  }
  return (
    <ArcadePanel eyebrow="Restricted staff evidence" title="Decision">
      <StatusLamp label={message} tone="attention" />
      {chosen === null ? (
        <p>No further decisions are possible for this application.</p>
      ) : (
        <form className="arcade-form" onSubmit={review}>
          <label>
            <span>Decision</span>
            <select
              name="action"
              onChange={(event) =>
                setChosen(
                  allowed.find((action) => action === event.target.value) ??
                    chosen,
                )
              }
              value={chosen}
            >
              {allowed.map((action) => (
                <option key={action} value={action}>
                  {creatorReviewActionLabels[action]}
                </option>
              ))}
            </select>
          </label>
          <AdmissionField
            defaultValue={creatorReviewReasonCodes[chosen]}
            key={chosen}
            label="Reason code"
            name="reasonCode"
          />
          <AdmissionField
            label="Creator feedback"
            name="creatorFeedback"
            required={false}
          />
          <AdmissionField
            label="Evidence URL (private)"
            name="evidenceReference"
            required={false}
          />
          <label>
            <span>Private reviewer notes</span>
            <textarea name="privateNotes" />
          </label>
          <button
            className="arcade-button arcade-button--yellow"
            disabled={working}
            type="submit"
          >
            Record decision
          </button>
        </form>
      )}
    </ArcadePanel>
  );
}
