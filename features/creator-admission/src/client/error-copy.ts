import { describeRequestFailure } from "@frostbite/client-http";

// What the reviewer is told, and what the page should offer, for a failed request.
export type FailureKind =
  "not-found" | "not-permitted" | "rejected" | "sign-in" | "temporary";

export interface Failure {
  readonly kind: FailureKind;
  readonly message: string;
  readonly retryable: boolean;
}

// What the reviewer is told for a failed request. What is particular to creator applications is here; the words every request shares are in
// `describeRequestFailure`.
export function describeFailure(error: unknown): Failure {
  return describeRequestFailure<Exclude<FailureKind, "sign-in" | "temporary">>(
    error,
    {
      forbidden: {
        kind: "not-permitted",
        message: "Only reviewers can read creator applications.",
      },
      invalid_request: { kind: "rejected" },
      not_found: {
        kind: "not-found",
        message: "This application could not be found.",
      },
    },
  );
}
