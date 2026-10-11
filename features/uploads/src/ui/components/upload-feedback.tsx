import type { ReactNode } from "react";
import {
  ArcadeActionButton,
  ArcadeProgress,
  StatusLamp,
} from "@repo/ui/arcade";

import {
  availableUploadActions,
  describeUploadState,
} from "../../client/upload-messages.ts";
import type { UploadState } from "../../client/upload-state.ts";

// What the user is told about the current upload, and the controls that make sense right now. It
// derives everything from the state, so it cannot disagree with it.
export function UploadFeedback({
  next,
  onCancel,
  onReset,
  onRetry,
  state,
}: {
  // What to do with an image that was uploaded and processed, when the page has somewhere to send it.
  readonly next?: ReactNode;
  readonly onCancel: () => void;
  readonly onReset: () => void;
  readonly onRetry: () => void;
  readonly state: UploadState;
}) {
  const message = describeUploadState(state);
  if (message === null) return null;
  const actions = availableUploadActions(state);
  return (
    <div className="arcade-form" data-testid="upload-feedback">
      <StatusLamp label={message.text} tone={message.tone} />
      {state.status === "running" && state.stage === "transferring" ? (
        <ArcadeProgress label="Upload progress" value={state.progress} />
      ) : null}
      <div className="arcade-actions">
        {state.status === "finished" && state.outcome === "processed"
          ? next
          : null}
        {actions.cancel ? (
          <ArcadeActionButton onClick={onCancel} tone="red">
            Cancel upload
          </ArcadeActionButton>
        ) : null}
        {actions.retry ? (
          <ArcadeActionButton onClick={onRetry} tone="yellow">
            Retry
          </ArcadeActionButton>
        ) : null}
        {actions.reset ? (
          <ArcadeActionButton onClick={onReset} tone="cyan">
            {state.status === "finished"
              ? "Upload another"
              : "Choose a different file"}
          </ArcadeActionButton>
        ) : null}
      </div>
    </div>
  );
}
