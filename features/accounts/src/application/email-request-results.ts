import type { RequestCodeResult } from "@ador/auth";
import { failure, type HttpFailure } from "@ador/http/outcome";

// One answer for every way entering a code can fail (wrong, expired, used, never sent, tries spent), so it teaches a caller nothing about
// which addresses have accounts or codes.
export const codeNotVerified = failure(
  "unauthorized",
  "That code is not right, or it has expired. Check it, or ask for a new one.",
);

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

// How long to wait, in the person's terms, rounded up so "try again" is never too early.
function waitText(ms: number): string {
  const seconds = Math.ceil(ms / MS_PER_SECOND);
  if (seconds < SECONDS_PER_MINUTE)
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// How a refused request for a code is told to the person, for signing in and for linking alike. None of these depends on whether the
// address has an account.
export function codeRequestFailure(
  result: Exclude<RequestCodeResult, { readonly ok: true }>,
): HttpFailure {
  switch (result.reason) {
    case "invalid-destination":
      return failure("invalid_request", "Enter a valid email address.");
    case "unsupported-channel":
      return failure("not_found", "Signing in by email is not available.");
    case "delivery-failed":
      return failure(
        "conflict",
        "The code could not be sent. Try again in a moment.",
      );
    case "cooldown":
    case "limit":
      return failure(
        "conflict",
        `A code was sent recently. You can ask for another in ${waitText(result.retryAfterMs)}.`,
      );
  }
}
