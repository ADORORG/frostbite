import type { HttpErrorCode } from "@ador/shared/http";

// `network`: the request never produced a response. `invalid-response`: it did, but not in the
// documented shape, so nothing in it is trusted.
export type ApiErrorCode = HttpErrorCode | "invalid-response" | "network";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;

  constructor(code: ApiErrorCode, status: number | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const retryableCodes: readonly ApiErrorCode[] = [
  "internal_error",
  "invalid-response",
  "network",
];

// Failures worth offering a retry for: transient transport or server faults. Everything else (bad
// input, no session, a conflicting request) will fail again the same way.
export function isRetryableApiError(error: ApiError): boolean {
  return retryableCodes.includes(error.code);
}
