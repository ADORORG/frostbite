import type { ApplicationHttpErrorCode } from "@ador/shared/http";

import type { HttpOperationResult } from "./operation.ts";

export type HttpFailure = Extract<
  HttpOperationResult<object>,
  { readonly ok: false }
>;

// An operation's failure result, so every feature reports errors the same way and none restates the shape.
export function failure(
  error: ApplicationHttpErrorCode,
  message: string,
  reason?: string,
): HttpFailure {
  return reason === undefined
    ? { error, message, ok: false }
    : { error, message, ok: false, reason };
}

export const unauthenticated = failure(
  "unauthorized",
  "Authentication is required.",
);

// The answer for a request whose idempotency key was already used for a different request. Every operation that takes a key answers it the
// same way, so it is written once here.
export const idempotencyKeyConflict = failure(
  "conflict",
  "The idempotency key conflicts with another request.",
);
