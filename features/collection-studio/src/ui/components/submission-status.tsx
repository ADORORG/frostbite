import type { CollectionSubmission } from "@frostbite/shared/collections";
import { StatusLamp } from "@repo/ui/arcade";

import { submissionStateCopy } from "../../client/submission-copy.ts";

const day = (timestamp: string) => timestamp.slice(0, 10);

// The newest submission: where it stands in plain words, every step it has been through with the
// feedback reviewers wrote for the creator, and a warning when the draft has changed since the version
// that was submitted. The creator sees what happened and when, never who decided or the private notes.
export function SubmissionStatus({
  changedSince,
  submission,
}: {
  readonly changedSince: boolean;
  readonly submission: CollectionSubmission;
}) {
  const copy = submissionStateCopy[submission.state];
  return (
    <section aria-label="Submission status" className="arcade-form">
      <StatusLamp
        label={`Submission ${String(submission.sequence)}: ${copy.label}`}
        tone={copy.tone}
      />
      <p>{copy.summary}</p>
      <ol aria-label="History of this submission">
        <li>
          <strong>Submitted</strong> <small>{day(submission.createdAt)}</small>
        </li>
        {submission.decisions.map((decision) => (
          <li key={`${decision.createdAt}-${decision.action}`}>
            <strong>{submissionStateCopy[decision.nextState].label}</strong>{" "}
            <small>{day(decision.createdAt)}</small>
            {decision.creatorFeedback === "" ? null : (
              <p aria-label="Feedback from a reviewer">
                {decision.creatorFeedback}
              </p>
            )}
          </li>
        ))}
      </ol>
      {changedSince ? (
        <p>
          You have changed this collection since it was submitted. Those changes
          are not part of the version that was submitted.
        </p>
      ) : null}
    </section>
  );
}
