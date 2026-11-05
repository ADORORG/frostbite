import { failure, type HttpFailure } from "@frostbite/http/outcome";
import {
  accountOutcomes,
  type AccountOutcome,
} from "@frostbite/shared/account-outcomes";

// The status classes an operation may answer with. A rate limit is answered by the platform before an operation runs, and an outcome
// with no status class only happens in the browser, so neither can be built here.
type ServerOutcome = {
  [Name in AccountOutcome]: (typeof accountOutcomes)[Name]["http"] extends
    "conflict" | "forbidden" | "invalid_request" | "not_found" | "unauthorized"
    ? Name
    : never;
}[AccountOutcome];

// A failure of an account operation, built from the catalogue (`@frostbite/shared/account-outcomes`): its status class and sentence are the
// catalogue's, and its reason travels in the error envelope so the page can choose its own words by it. `words` replaces the sentence only
// where the server knows more than the catalogue (how long to wait).
export function outcomeFailure(
  outcome: ServerOutcome,
  words?: string,
): HttpFailure {
  const { http, message } = accountOutcomes[outcome];
  return failure(http, words ?? message, outcome);
}
