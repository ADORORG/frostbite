import type { HttpErrorCode } from "@ador/shared/http";

// `network`: the request never produced a response. `invalid-response`: it did, but not in the
// documented shape, so nothing in it is trusted.
export type UploadApiErrorCode = HttpErrorCode | "invalid-response" | "network";

export class UploadApiError extends Error {
  readonly code: UploadApiErrorCode;
  readonly status: number | null;

  constructor(
    code: UploadApiErrorCode,
    status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "UploadApiError";
    this.code = code;
    this.status = status;
  }
}

const retryableCodes: readonly UploadApiErrorCode[] = [
  "internal_error",
  "invalid-response",
  "network",
];

// Failures worth offering a retry for: transient transport or server faults. Everything else (bad
// input, no session, a conflicting request) will fail again the same way.
export function isRetryableApiError(error: UploadApiError): boolean {
  return retryableCodes.includes(error.code);
}
