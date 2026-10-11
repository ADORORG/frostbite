import { ApiError, isRetryableApiError } from "@ador/client-http";

// What the reviewer is told, and what the page should offer, for a failed request.
export type FailureKind =
  "not-found" | "not-permitted" | "rejected" | "sign-in" | "temporary";

export interface Failure {
  readonly kind: FailureKind;
  readonly message: string;
  readonly retryable: boolean;
}

// `unknown` is what a caught value is: anything can be thrown. It is narrowed to `ApiError` here, and
// anything else is reported as a temporary fault.
export function describeFailure(error: unknown): Failure {
  if (!(error instanceof ApiError))
    return {
      kind: "temporary",
      message: "Something went wrong. Try again.",
      retryable: true,
    };
  switch (error.code) {
    case "unauthorized":
      return {
        kind: "sign-in",
        message: "Your session has ended. Sign in again to continue.",
        retryable: false,
      };
    case "forbidden":
      return {
        kind: "not-permitted",
        message: "Only reviewers can read creator applications.",
        retryable: false,
      };
    case "not_found":
      return {
        kind: "not-found",
        message: "This application could not be found.",
        retryable: false,
      };
    case "invalid_request":
      return { kind: "rejected", message: error.message, retryable: false };
    default:
      return {
        kind: "temporary",
        message:
          error.code === "network"
            ? "The request could not reach the server. Check your connection and try again."
            : "The server had a problem. Try again in a moment.",
        retryable: isRetryableApiError(error),
      };
  }
}
