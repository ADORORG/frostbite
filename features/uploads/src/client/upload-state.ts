import type { AssetRejectionReason, UploadPurpose } from "@ador/shared/uploads";
import type { IdempotencyKey } from "@ador/shared/http";

import type { UploadApiErrorCode } from "./api-error.ts";
import type { FileRejection } from "./file-checks.ts";
import type { TransferFailure } from "./transfer.ts";

export const uploadStages = [
  "requesting",
  "transferring",
  "completing",
  "processing",
] as const;
export type UploadStage = (typeof uploadStages)[number];

// What is known about one upload attempt. Retrying reuses it: the idempotency key makes intent
// creation and completion safe to repeat, and the markers let a retry skip finished work.
export interface UploadAttempt {
  readonly assetId: string | null;
  readonly file: { readonly name: string; readonly size: number };
  readonly idempotencyKey: IdempotencyKey;
  readonly purpose: UploadPurpose;
  readonly transferred: boolean;
}

export type FinishedOutcome = "processed" | "rejected" | "unprocessable";

export type FailureCause =
  | { readonly kind: "api"; readonly code: UploadApiErrorCode }
  | { readonly kind: "transfer"; readonly failure: TransferFailure }
  // A defect in this page, not a failure of the network or the server.
  | { readonly kind: "unexpected" };

export type UploadState =
  | { readonly status: "idle" }
  | { readonly status: "invalid-file"; readonly rejection: FileRejection }
  | {
      readonly attempt: UploadAttempt;
      readonly progress: number;
      readonly stage: UploadStage;
      readonly status: "running";
    }
  | {
      readonly attempt: UploadAttempt;
      readonly cause: FailureCause;
      readonly retryable: boolean;
      readonly stage: UploadStage;
      readonly status: "failed";
    }
  // Validation and processing did not finish inside the wait budget. Not a failure: the asset
  // keeps processing and will appear in the library.
  | { readonly attempt: UploadAttempt; readonly status: "still-processing" }
  | {
      readonly attempt: UploadAttempt;
      readonly outcome: FinishedOutcome;
      readonly reason: AssetRejectionReason | null;
      readonly status: "finished";
    }
  | { readonly attempt: UploadAttempt; readonly status: "cancelled" };

export type UploadEvent =
  | { readonly type: "file-invalid"; readonly rejection: FileRejection }
  | { readonly type: "started"; readonly attempt: UploadAttempt }
  | { readonly type: "stage-entered"; readonly stage: UploadStage }
  | { readonly type: "progress"; readonly fraction: number }
  | { readonly type: "transferred" }
  | { readonly type: "completed"; readonly assetId: string }
  | {
      readonly type: "failed";
      readonly cause: FailureCause;
      readonly retryable: boolean;
    }
  | { readonly type: "still-processing" }
  | {
      readonly type: "finished";
      readonly outcome: FinishedOutcome;
      readonly reason: AssetRejectionReason | null;
    }
  | { readonly type: "cancelled" }
  | { readonly type: "retry" }
  | { readonly type: "reset" };

export const initialUploadState: UploadState = { status: "idle" };

export function isUploadBusy(state: UploadState): boolean {
  return state.status === "running";
}

const clamp = (fraction: number) => Math.min(1, Math.max(0, fraction));

// Events that do not apply to the current state are ignored, so a late progress callback after a
// cancel or a failure cannot resurrect a finished attempt.
export function uploadReducer(
  state: UploadState,
  event: UploadEvent,
): UploadState {
  switch (event.type) {
    case "file-invalid":
      return isUploadBusy(state)
        ? state
        : { rejection: event.rejection, status: "invalid-file" };
    case "started":
      return isUploadBusy(state)
        ? state
        : {
            attempt: event.attempt,
            progress: 0,
            stage: "requesting",
            status: "running",
          };
    case "reset":
      return isUploadBusy(state) ? state : initialUploadState;
    // A retry is a new run of the same attempt, so its markers (and idempotency key) survive.
    case "retry":
      return state.status === "failed" ||
        state.status === "cancelled" ||
        state.status === "still-processing"
        ? {
            attempt: state.attempt,
            progress: 0,
            stage: "requesting",
            status: "running",
          }
        : state;
    default:
      break;
  }
  if (state.status !== "running") return state;
  const { attempt } = state;
  switch (event.type) {
    case "stage-entered":
      return {
        ...state,
        progress: event.stage === "transferring" ? 0 : state.progress,
        stage: event.stage,
      };
    case "progress":
      return state.stage === "transferring"
        ? { ...state, progress: clamp(event.fraction) }
        : state;
    case "transferred":
      return {
        ...state,
        attempt: { ...attempt, transferred: true },
        progress: 1,
      };
    case "completed":
      return { ...state, attempt: { ...attempt, assetId: event.assetId } };
    case "failed":
      return {
        attempt,
        cause: event.cause,
        retryable: event.retryable,
        stage: state.stage,
        status: "failed",
      };
    case "still-processing":
      return { attempt, status: "still-processing" };
    case "finished":
      return {
        attempt,
        outcome: event.outcome,
        reason: event.reason,
        status: "finished",
      };
    case "cancelled":
      return { attempt, status: "cancelled" };
  }
}
