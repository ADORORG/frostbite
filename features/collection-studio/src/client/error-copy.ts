import { describeRequestFailure } from "@frostbite/client-http";

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

// What the person is told for a failed request. What is particular to collections is here; the words every request shares are in
// `describeRequestFailure`.
export function describeFailure(error: unknown): Failure {
  return describeRequestFailure<Exclude<FailureKind, "sign-in" | "temporary">>(
    error,
    {
      conflict: { kind: "conflict" },
      forbidden: {
        kind: "not-approved",
        message: "Only approved creators can create or change collections.",
      },
      invalid_request: { kind: "rejected" },
      not_found: {
        kind: "not-found",
        message: "This collection could not be found.",
      },
    },
  );
}
