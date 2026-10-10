import { ArcadeActionButton, ArcadeButton, StatusLamp } from "@repo/ui/arcade";

import type { Failure } from "../../client/error-copy.ts";

// A failed action, in words, with the one thing worth doing about it: reload when what is on screen
// moved on, sign in again when the session ended, retry when the fault was temporary.
export function FailureNotice({
  failure,
  onDismiss,
  onReload,
  signInHref,
}: {
  readonly failure: Failure;
  readonly onDismiss: () => void;
  readonly onReload: () => void;
  readonly signInHref: string;
}) {
  return (
    <div className="arcade-form" role="alert">
      <StatusLamp label={failure.message} tone="unavailable" />
      <div className="arcade-actions">
        {failure.kind === "conflict" ? (
          <ArcadeActionButton onClick={onReload} tone="yellow">
            Reload the submission
          </ArcadeActionButton>
        ) : null}
        {failure.kind === "sign-in" ? (
          <ArcadeButton href={signInHref} tone="yellow">
            Sign in
          </ArcadeButton>
        ) : null}
        <ArcadeActionButton
          onClick={onDismiss}
          tone={failure.retryable ? "yellow" : "pink"}
        >
          {failure.retryable ? "Dismiss and try again" : "Dismiss"}
        </ArcadeActionButton>
      </div>
    </div>
  );
}
