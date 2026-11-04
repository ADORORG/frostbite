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

// The answer for a paginated read given a cursor the list did not produce. It is refused, not treated as the start of the list, and every
// list says so in the same words.
export const invalidCursor = failure(
  "invalid_request",
  "The page cursor is not valid.",
);

// What a request is told when the caller is signed in but lacks the capability the operation needs. The API's documentation and the
// platform's answer say it in the same words.
export const forbiddenMessage = "The actor lacks the required capability.";
