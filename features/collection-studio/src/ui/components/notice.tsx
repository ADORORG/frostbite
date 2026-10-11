import { ArcadeActionButton, ArcadeButton, StatusLamp } from "@repo/ui/arcade";

import type { Failure } from "../../client/error-copy.ts";

// A failed action, in words, with the one thing worth doing about it: reload when the draft changed
// elsewhere, apply when the creator is not approved, retry when the fault was temporary.
export function FailureNotice({
  applyHref,
  failure,
  onDismiss,
  onReload,
}: {
  readonly applyHref: string;
  readonly failure: Failure;
  readonly onDismiss: () => void;
  readonly onReload: () => void;
}) {
  return (
    <div className="arcade-form">
      <StatusLamp label={failure.message} tone="unavailable" />
      <div className="arcade-actions">
        {failure.kind === "conflict" ? (
          <ArcadeActionButton onClick={onReload} tone="yellow">
            Reload the draft
          </ArcadeActionButton>
        ) : null}
        {failure.kind === "not-approved" ? (
          <ArcadeButton href={applyHref} tone="yellow">
            Apply to create
          </ArcadeButton>
        ) : null}
        {failure.retryable ? (
          <ArcadeActionButton onClick={onDismiss} tone="yellow">
            Dismiss and try again
          </ArcadeActionButton>
        ) : (
          <ArcadeActionButton onClick={onDismiss} tone="pink">
            Dismiss
          </ArcadeActionButton>
        )}
      </div>
    </div>
  );
}
