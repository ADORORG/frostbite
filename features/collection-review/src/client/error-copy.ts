import { describeRequestFailure } from "@ador/client-http";

// What the reviewer is told, and what the page should offer, for a failed request.
export type FailureKind =
  | "conflict"
  | "not-found"
  | "not-permitted"
  | "rejected"
  | "sign-in"
  | "temporary";

export interface Failure {
  readonly kind: FailureKind;
  readonly message: string;
  readonly retryable: boolean;
}

// What the reviewer is told for a failed request. What is particular to reviewing is here; the words every request shares are in
// `describeRequestFailure`.
export function describeFailure(error: unknown): Failure {
  return describeRequestFailure<Exclude<FailureKind, "sign-in" | "temporary">>(
    error,
    {
      conflict: { kind: "conflict" },
      forbidden: {
        kind: "not-permitted",
        message:
          "You cannot do this. Only reviewers can decide, and nobody can review their own collection.",
      },
      invalid_request: { kind: "rejected" },
      not_found: {
        kind: "not-found",
        message: "This submission could not be found.",
      },
    },
  );
}
