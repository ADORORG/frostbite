import type { ApiErrorCode } from "@frostbite/client-http";
import {
  isUploadOutcome,
  uploadOutcomeMessage,
  uploadOutcomes,
} from "@frostbite/shared/uploads";
import { assetRejectionCopy, describeFileRejection } from "./rejection-copy.ts";
import type { FailureCause, UploadStage, UploadState } from "./upload-state.ts";

export type MessageTone = "attention" | "ready" | "unavailable";

export interface UploadMessage {
  readonly text: string;
  readonly tone: MessageTone;
}

const stageText: Readonly<Record<UploadStage, string>> = {
  completing: "Finalizing the upload…",
  processing: "Checking and processing your image…",
  requesting: "Preparing the upload…",
  transferring: "Uploading your image…",
};

const apiFailureText: Readonly<Record<ApiErrorCode, string>> = {
  conflict: "The upload could not go ahead. Choose the file again.",
  forbidden: "You do not have permission to upload here.",
  idempotency_key_required:
    "The upload request was incomplete. Choose the file again.",
  internal_error: "The server had a problem. Retry in a moment.",
  invalid_request:
    "The server did not accept this file. Check its type and size.",
  "invalid-response":
    "The server sent an unexpected response. Retry in a moment.",
  method_not_allowed:
    "The upload request was not allowed. Reload the page and try again.",
  network: "Could not reach the server. Check your connection and retry.",
  not_found: uploadOutcomes["upload-not-found"].message,
  rate_limited: "Too many requests in a short time. Wait a moment, then retry.",
  unauthorized: "Your session has ended. Sign in again to upload.",
};

function describeFailure(cause: FailureCause): string {
  if (cause.kind === "unexpected")
    return "Something went wrong in this page. Reload it and try again.";
  // The reason the server named, when it is one of the catalogue's, says more than the status class it came with (two different conflicts).
  if (cause.kind === "api") {
    const reason = cause.reason ?? null;
    return isUploadOutcome(reason)
      ? uploadOutcomeMessage(reason)
      : apiFailureText[cause.code];
  }
  return cause.failure === "network"
    ? "The file could not be sent. Check your connection and retry."
    : cause.failure === "stalled"
      ? "The file stopped sending. Check your connection and retry."
      : "The storage service did not accept the upload. The upload link may have expired; retry.";
}

// The one line the user reads for each state. Nothing here claims success before the server has
// reported it: a finished upload says what the server decided.
export function describeUploadState(state: UploadState): UploadMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid-file":
      return {
        text: describeFileRejection(state.rejection),
        tone: "unavailable",
      };
    case "running":
      return { text: stageText[state.stage], tone: "attention" };
    case "failed":
      return { text: describeFailure(state.cause), tone: "unavailable" };
    case "still-processing":
      return {
        text: "Processing is taking longer than usual. It will keep going; check the library below.",
        tone: "attention",
      };
    case "cancelled":
      return {
        text: "Upload cancelled. Nothing was added to your library.",
        tone: "attention",
      };
    case "finished":
      return state.outcome === "processed"
        ? {
            text: "Upload processed. It is saved to your library as a private draft.",
            tone: "ready",
          }
        : {
            text:
              state.reason === null
                ? "This file could not be accepted."
                : assetRejectionCopy[state.reason],
            tone: "unavailable",
          };
  }
}

export interface UploadActions {
  readonly cancel: boolean;
  readonly reset: boolean;
  readonly retry: boolean;
}

// Which controls make sense now. Retrying is offered for retryable failures, a cancel, and an
// upload still processing; a rejected file needs a new file, not a retry.
export function availableUploadActions(state: UploadState): UploadActions {
  switch (state.status) {
    case "running":
      return { cancel: true, reset: false, retry: false };
    case "failed":
      return { cancel: false, reset: true, retry: state.retryable };
    case "cancelled":
    case "still-processing":
      return { cancel: false, reset: true, retry: true };
    case "finished":
    case "invalid-file":
      return { cancel: false, reset: true, retry: false };
    case "idle":
      return { cancel: false, reset: false, retry: false };
  }
}
