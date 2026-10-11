import { ApiError, isRetryableApiError } from "@ador/client-http";

// What the person is told, and what the page should offer, for a failed request.
export type FailureKind =
  | "conflict"
  | "not-approved"
  | "not-found"
  | "rejected"
  | "sign-in"
  | "temporary";

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
        kind: "not-approved",
        message: "Only approved creators can create or change collections.",
        retryable: false,
      };
    case "not_found":
      return {
        kind: "not-found",
        message: "This collection could not be found.",
        retryable: false,
      };
    case "conflict":
      return {
        kind: "conflict",
        message: error.message,
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
