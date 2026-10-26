import type { HttpErrorCode } from "@ador/shared/http";

// `network`: the request never produced a response. `invalid-response`: it did, but not in the
// documented shape, so nothing in it is trusted.
export type ApiErrorCode = HttpErrorCode | "invalid-response" | "network";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  // The reference the server logged this failure under, when it sent one, so a person can quote it and staff can find the log line.
  readonly correlationId: string | null;
  // Why, when the server named a reason (`httpErrorReasonSchema`): what a page chooses its words by, never the message.
  readonly reason: string | null;
  readonly status: number | null;

  constructor(
    code: ApiErrorCode,
    status: number | null,
    message: string,
    correlationId: string | null = null,
    reason: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.correlationId = correlationId;
    this.reason = reason;
    this.status = status;
  }
}

const retryableCodes: readonly ApiErrorCode[] = [
  "internal_error",
  "invalid-response",
  "network",
  // The limit passes with time, so trying again later can work.
  "rate_limited",
];

// Failures worth offering a retry for: transient transport or server faults. Everything else (bad
// input, no session, a conflicting request) will fail again the same way.
export function isRetryableApiError(error: ApiError): boolean {
  return retryableCodes.includes(error.code);
}
