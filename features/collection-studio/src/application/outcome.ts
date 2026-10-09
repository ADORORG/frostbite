import type { ApplicationHttpErrorCode } from "@ador/shared/http";

export interface Failure {
  readonly error: ApplicationHttpErrorCode;
  readonly message: string;
  readonly ok: false;
}

export function failure(
  error: ApplicationHttpErrorCode,
  message: string,
): Failure {
  return { error, message, ok: false };
}

export const unauthenticated = failure(
  "unauthorized",
  "Authentication is required.",
);

// The outcomes every mutation can report; each maps to one stable HTTP error.
export const commonFailures = {
  "invalid-asset": failure(
    "invalid_request",
    "An image must be a processed upload of yours, made for this use.",
  ),
  "invalid-chain": failure(
    "invalid_request",
    "The target chain is not available.",
  ),
  "not-eligible": failure(
    "forbidden",
    "Only approved creators can change collections.",
  ),
  "not-found": failure("not_found", "The collection was not found."),
} as const;
