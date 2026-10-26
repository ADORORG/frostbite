import { failure } from "@ador/http/outcome";

// Re-exported so the operations in this feature import their outcomes from one place.
export {
  failure,
  idempotencyKeyConflict,
  unauthenticated,
} from "@ador/http/outcome";

// A save or submission based on an older view of the draft than the one stored.
export const revisionConflict = failure(
  "conflict",
  "The draft changed since it was loaded. Reload it and try again.",
);

// The outcomes every mutation can report; each maps to one stable HTTP error.
export const commonFailures = {
  "invalid-asset": failure(
    "invalid_request",
    "An image must be a processed upload of yours, made for this use.",
  ),
  "invalid-chain": failure(
    "invalid_request",
    "The target chain is not available.",
  ),
  "not-eligible": failure(
    "forbidden",
    "Only approved creators can change collections.",
  ),
  "not-found": failure("not_found", "The collection was not found."),
} as const;
