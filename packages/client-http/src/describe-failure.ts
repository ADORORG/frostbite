import { ApiError, isRetryableApiError } from "./api-error.ts";

// What a page tells a person, and what it offers, when a request failed. The words for the failures every request can have (anything that
// was not an `ApiError`, a session that has ended, no connection, a server fault) are written here once. A feature supplies only what is
// particular to it: which kind and what words for the few answers it can tell apart (not allowed, not found, a conflict, a refusal).
export type RequestFailureCode =
  "conflict" | "forbidden" | "invalid_request" | "not_found";

// A feature's answer to one status class: the kind it files it under, and its words. Without words the server's own are shown (they are
// written for a person: what was refused, or what to do).
export interface FailureWording<Kind extends string> {
  readonly kind: Kind;
  readonly message?: string;
}

export interface RequestFailure<Kind extends string> {
  readonly kind: Kind | "sign-in" | "temporary";
  readonly message: string;
  readonly retryable: boolean;
}

export function describeRequestFailure<Kind extends string>(
  error: unknown,
  wording: Partial<Record<RequestFailureCode, FailureWording<Kind>>>,
): RequestFailure<Kind> {
  // `unknown` is what a caught value is: anything can be thrown. Only an `ApiError` says what the server answered; anything else is a
  // temporary fault.
  if (!(error instanceof ApiError))
    return {
      kind: "temporary",
      message: "Something went wrong. Try again.",
      retryable: true,
    };
  if (error.code === "unauthorized")
    return {
      kind: "sign-in",
      message: "Your session has ended. Sign in again to continue.",
      retryable: false,
    };
  const particular =
    error.code === "conflict" ||
    error.code === "forbidden" ||
    error.code === "invalid_request" ||
    error.code === "not_found"
      ? wording[error.code]
      : undefined;
  if (particular !== undefined)
    return {
      kind: particular.kind,
      message: particular.message ?? error.message,
      retryable: false,
    };
  return {
    kind: "temporary",
    message:
      error.code === "network"
        ? "The request could not reach the server. Check your connection and try again."
        : "The server had a problem. Try again in a moment.",
    retryable: isRetryableApiError(error),
  };
}
