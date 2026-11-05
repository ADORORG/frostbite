import { ApiError } from "@frostbite/client-http";
import {
  isAccountOutcome,
  outcomeMessage,
  type AccountOutcome,
} from "@frostbite/shared/account-outcomes";

// A step that did not work, as a page tells it: which outcome of the catalogue (`@frostbite/shared/account-outcomes`) and its words. Every flow
// returns this one shape for every failure, so no flow has a table of its own.
export interface Failed {
  readonly kind: "failed";
  readonly message: string;
  readonly outcome: AccountOutcome;
}

export function failed(
  outcome: AccountOutcome,
  serverMessage?: string,
): Failed {
  return {
    kind: "failed",
    message: outcomeMessage(outcome, serverMessage ?? null),
    outcome,
  };
}

// What a failed request means. The server's reason decides when it sent one that the catalogue knows; the status class alone decides only
// for what the server could not have named (no connection, a rate limit, a session that is gone), and `otherwise` says what any other
// answer is taken to be by the step that asked. Never the message: rewording a sentence cannot change what a page does.
export function outcomeOf(
  error: unknown,
  otherwise: AccountOutcome = "network",
): AccountOutcome {
  if (!(error instanceof ApiError)) throw error;
  if (isAccountOutcome(error.reason)) return error.reason;
  switch (error.code) {
    case "network":
    case "internal_error":
    case "invalid-response":
      return "network";
    case "rate_limited":
      return "rate-limited";
    case "unauthorized":
      return "signed-out";
    case "forbidden":
      return "recent-authentication-required";
    default:
      return otherwise;
  }
}

// The same, as a `Failed`, with the server's words kept for the few outcomes where it knows more than the catalogue.
export function failedFrom(
  error: unknown,
  otherwise: AccountOutcome = "network",
): Failed {
  return failed(
    outcomeOf(error, otherwise),
    error instanceof ApiError ? error.message : undefined,
  );
}
