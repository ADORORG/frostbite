import type { RequestCodeResult } from "@ador/auth";
import type { HttpFailure } from "@ador/http/outcome";

import { outcomeFailure } from "./outcomes.ts";

// One answer for every way entering a code can fail (wrong, expired, used, never sent, tries spent), so it teaches a caller nothing about
// which addresses have accounts or codes.
export const codeNotVerified = outcomeFailure("code-wrong");

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
      return outcomeFailure("invalid-email");
    case "unsupported-channel":
      return outcomeFailure("email-unavailable");
    case "delivery-failed":
      return outcomeFailure("code-not-sent");
    case "cooldown":
    case "limit":
      return outcomeFailure(
        "code-too-soon",
        `A code was sent recently. You can ask for another in ${waitText(result.retryAfterMs)}.`,
      );
  }
}
