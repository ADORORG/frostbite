import type { IdempotencyKey } from "@ador/shared/http";
import type { LibraryAsset } from "@ador/shared/uploads";

import { waitForAsset } from "./asset-poller.ts";
import { isRetryableApiError, ApiError } from "@ador/client-http";
import type { UploadsApi } from "./api-client.ts";
import type { UploadClientPolicy } from "./client-policy.ts";
import type { CheckedFile } from "./file-checks.ts";
import { TransferError, type ObjectTransfer } from "./transfer.ts";
import type {
  FinishedOutcome,
  UploadAttempt,
  UploadEvent,
} from "./upload-state.ts";

export interface UploadRunnerDependencies {
  readonly api: UploadsApi;
  readonly policy: UploadClientPolicy;
  readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly transfer: ObjectTransfer;
}

export interface UploadRun {
  readonly attempt: UploadAttempt;
  readonly checked: CheckedFile;
  readonly emit: (event: UploadEvent) => void;
  readonly file: Blob;
  readonly signal: AbortSignal;
}

export function createUploadAttempt(input: {
  readonly file: { readonly name: string; readonly size: number };
  readonly idempotencyKey: IdempotencyKey;
  readonly purpose: UploadAttempt["purpose"];
}): UploadAttempt {
  return { ...input, assetId: null, transferred: false };
}

function outcomeOf(asset: LibraryAsset): FinishedOutcome {
  // Only final states reach here (see `waitForAsset`).
  return asset.processingState === "processed"
    ? "processed"
    : asset.processingState === "rejected"
      ? "rejected"
      : "unprocessable";
}

// Runs (or resumes) one attempt and reports everything through `emit`; expected failures never
// throw. Stages already recorded on the attempt are skipped, so a retry after a finished transfer
// never writes the object again. Intent creation is repeated on purpose: the same idempotency key
// returns the same intent with a fresh signed URL, and completion is itself idempotent.
export function createUploadRunner(dependencies: UploadRunnerDependencies) {
  const { api, policy, sleep, transfer } = dependencies;

  async function secureAsset(run: UploadRun): Promise<string> {
    const { attempt, checked, emit, file, signal } = run;
    if (attempt.assetId !== null) return attempt.assetId;
    emit({ stage: "requesting", type: "stage-entered" });
    const created = await api.createIntent(
      {
        byteLength: checked.byteLength,
        contentType: checked.contentType,
        purpose: attempt.purpose,
      },
      { idempotencyKey: attempt.idempotencyKey, signal },
    );
    if (!attempt.transferred) {
      emit({ stage: "transferring", type: "stage-entered" });
      await transfer.upload({
        body: file,
        headers: created.upload.headers,
        onProgress: (fraction) => emit({ fraction, type: "progress" }),
        signal,
        url: created.upload.url,
      });
      emit({ type: "transferred" });
    }
    emit({ stage: "completing", type: "stage-entered" });
    const { asset } = await api.completeIntent(
      { intentId: created.intent.id },
      { signal },
    );
    emit({ assetId: asset.id, type: "completed" });
    return asset.id;
  }

  return async function run(input: UploadRun): Promise<void> {
    const { emit, signal } = input;
    try {
      const assetId = await secureAsset(input);
      emit({ stage: "processing", type: "stage-entered" });
      const result = await waitForAsset({
        api,
        assetId,
        policy,
        signal,
        sleep,
      });
      if (result.kind === "timed-out")
        return emit({ type: "still-processing" });
      emit({
        outcome: outcomeOf(result.asset),
        reason: result.asset.rejectionReason,
        type: "finished",
      });
    } catch (error) {
      // A cancel surfaces as whatever the aborted call throws; the signal is the source of truth.
      if (signal.aborted) return emit({ type: "cancelled" });
      if (error instanceof TransferError)
        return emit({
          cause: { failure: error.failure, kind: "transfer" },
          retryable: true,
          type: "failed",
        });
      if (error instanceof ApiError)
        return emit({
          cause: { code: error.code, kind: "api" },
          retryable: isRetryableApiError(error),
          type: "failed",
        });
      throw error;
    }
  };
}
