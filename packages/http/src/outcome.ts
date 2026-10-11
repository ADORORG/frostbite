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
): HttpFailure {
  return { error, message, ok: false };
}

export const unauthenticated = failure(
  "unauthorized",
  "Authentication is required.",
);
