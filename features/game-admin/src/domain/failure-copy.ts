import { ApiError } from "@frostbite/client-http";

// The five things the page asks the platform to do, named for what a failure of each can leave behind.
export type StepRequest = "load" | "record" | "send" | "start";

const doing: Readonly<Record<StepRequest, string>> = {
  load: "loading the steps",
  record: "recording the contract's address",
  send: "sending the signed step",
  start: "building the step",
};

// What is true about the step when a request failed without a clear answer. Only sending can have an effect the page cannot see: the
// network may have taken the transaction before the answer was lost.
const unknownEffect: Readonly<Record<StepRequest, string>> = {
  load: "Nothing was changed.",
  record: "Nothing was changed.",
  send: "The transaction may or may not have been sent: reload and check this step before signing again.",
  start: "Nothing was changed.",
};

const refused = "Nothing was changed.";

const reference = (id: string | null): string =>
  id === null
    ? ""
    : ` Reference ${id}, which staff can find in the platform's log.`;

// A request that timed out in the browser. The platform may still be working on it.
function timedOut(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

// The words for a failed request, by what failed: the platform's own refusals are worded where they happen, so this is for the
// request itself. The cause is named (signed out, not allowed, too many requests, no connection, too slow, a fault in the platform)
// together with what is true of the step afterwards, and a fault carries the reference the platform logged it under.
export function failureCopy(error: unknown, request: StepRequest): string {
  if (timedOut(error))
    return `The platform took too long to answer while ${doing[request]}. ${unknownEffect[request]}`;
  if (!(error instanceof ApiError))
    return `This page hit an unexpected error while ${doing[request]}. ${unknownEffect[request]}`;
  switch (error.code) {
    case "unauthorized":
      return "You are signed out. Sign in again.";
    case "forbidden":
      return `Your account is not allowed to administer games. ${refused}`;
    case "rate_limited":
      return `Too many requests in a short time. Wait a moment and try again. ${refused}`;
    case "conflict":
      return `Another change to this step happened first. Reload and look again. ${refused}`;
    case "invalid_request":
      return `The platform refused the request as invalid: ${error.message} ${refused}`;
    case "network":
      return `The platform could not be reached while ${doing[request]}: check your connection. ${unknownEffect[request]}`;
    case "internal_error":
      return `The platform failed while ${doing[request]}.${reference(error.correlationId)} ${unknownEffect[request]}`;
    case "invalid-response":
      return `The platform answered in a form this page does not understand while ${doing[request]}.${reference(error.correlationId)} ${unknownEffect[request]}`;
    case "idempotency_key_required":
    case "method_not_allowed":
    case "not_found":
      return `The platform does not recognise this request (${error.code}) while ${doing[request]}.${reference(error.correlationId)} ${refused}`;
  }
}
