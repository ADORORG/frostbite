import type { CollectionSubmission } from "@ador/shared/collections";
import { StatusLamp } from "@repo/ui/arcade";

import { submissionStateCopy } from "../../client/submission-copy.ts";

// The newest submission: where it stands in plain words, the feedback reviewers wrote for the creator,
// and a warning when the draft has changed since the version that was submitted.
export function SubmissionStatus({
  changedSince,
  submission,
}: {
  readonly changedSince: boolean;
  readonly submission: CollectionSubmission;
}) {
  const copy = submissionStateCopy[submission.state];
  const feedback = submission.decisions.filter(
    ({ creatorFeedback }) => creatorFeedback !== "",
  );
  return (
    <section aria-label="Submission status" className="arcade-form">
      <StatusLamp
        label={`Submission ${String(submission.sequence)}: ${copy.label}`}
        tone={copy.tone}
      />
      <p>{copy.summary}</p>
      {feedback.length === 0 ? null : (
        <ul aria-label="Feedback from reviewers">
          {feedback.map((decision) => (
            <li key={decision.createdAt}>
              <strong>{submissionStateCopy[decision.nextState].label}:</strong>{" "}
              {decision.creatorFeedback}
            </li>
          ))}
        </ul>
      )}
      {changedSince ? (
        <p>
          You have changed this collection since it was submitted. Those changes
          are not part of the version that was submitted.
        </p>
      ) : null}
    </section>
  );
}
