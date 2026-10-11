"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { creatorApplicationRoutes } from "@ador/shared/creator-admission";
import { ArcadePanel, StatusLamp } from "@repo/ui/arcade";

import {
  AdmissionField,
  sendCreatorAdmissionRequest,
} from "./form-helpers.tsx";

export function ReviewerForm() {
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
          applicationId: data.get("applicationId"),
          creatorFeedback: data.get("creatorFeedback"),
          evidenceReferences: data.get("evidenceReference")
            ? [data.get("evidenceReference")]
            : [],
          privateNotes: data.get("privateNotes"),
          reasonCode: data.get("reasonCode"),
        },
      );
      setMessage(`Decision recorded. State: ${result.application.state}.`);
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
    <ArcadePanel eyebrow="Restricted staff evidence" title="Admission review">
      <StatusLamp label={message} tone="attention" />
      <form className="arcade-form" onSubmit={review}>
        <AdmissionField label="Application UUID" name="applicationId" />
        <label>
          <span>Decision</span>
          <select name="action">
            <option value="start-review">Start review</option>
            <option value="approve">Approve</option>
            <option value="request-changes">Request changes</option>
            <option value="reject">Reject</option>
            <option value="suspend">Suspend</option>
            <option value="reinstate">Reinstate</option>
            <option value="revoke">Revoke</option>
          </select>
        </label>
        <AdmissionField label="Reason code" name="reasonCode" />
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
    </ArcadePanel>
  );
}
