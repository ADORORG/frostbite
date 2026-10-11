"use client";

import type { CreatorApplicationResponse } from "@ador/shared/creator-admission";
import { useState } from "react";

import {
  feedbackToShow,
  isEditable,
  ReviewerFeedback,
  SentApplication,
  StatusCard,
} from "./application-status.tsx";
import { CreatorDraftForm } from "./creator-draft-form.tsx";

// The applicant's page: where the application stands, and either the form (while it can still be
// changed) or what was sent (once it cannot). It holds the application so a save or a submit updates
// the card and the body together.
export function StudioApplication({
  initial,
}: {
  readonly initial: CreatorApplicationResponse["application"] | null;
}) {
  const [application, setApplication] = useState(initial);
  const feedback = feedbackToShow(application);
  return (
    <div className="arcade-stack">
      <div aria-live="polite">
        <StatusCard application={application} />
      </div>
      {feedback === null ? null : <ReviewerFeedback feedback={feedback} />}
      {isEditable(application) ? (
        <CreatorDraftForm
          application={application}
          onApplication={setApplication}
        />
      ) : application === null ? null : (
        <SentApplication draft={application.draft} />
      )}
    </div>
  );
}
