import { describe, expect, it } from "vitest";

import { ApiError } from "../src/api-error.ts";
import { describeRequestFailure } from "../src/describe-failure.ts";

const wording = {
  conflict: { kind: "conflict" },
  forbidden: { kind: "not-allowed", message: "You may not." },
  invalid_request: { kind: "rejected" },
  not_found: { kind: "missing", message: "It is not there." },
} as const;
const failure = (code: ApiError["code"], message = "the server's words") =>
  new ApiError(code, 400, message);

describe("what a page tells a person when a request failed", () => {
  it("calls anything that was not an ApiError a temporary fault, worth trying again", () => {
    expect(describeRequestFailure(new TypeError("a bug"), wording)).toEqual({
      kind: "temporary",
      message: "Something went wrong. Try again.",
      retryable: true,
    });
    expect(describeRequestFailure("nonsense", {})).toMatchObject({
      kind: "temporary",
    });
  });

  it("sends a person whose session has ended to sign in again, with no retry", () => {
    expect(describeRequestFailure(failure("unauthorized"), wording)).toEqual({
      kind: "sign-in",
      message: "Your session has ended. Sign in again to continue.",
      retryable: false,
    });
  });

  it("files what a feature can tell apart under its own kind, with its words or the server's", () => {
    expect(describeRequestFailure(failure("forbidden"), wording)).toEqual({
      kind: "not-allowed",
      message: "You may not.",
      retryable: false,
    });
    expect(describeRequestFailure(failure("not_found"), wording)).toMatchObject(
      {
        kind: "missing",
        message: "It is not there.",
      },
    );
    // Without words of its own, the server's are shown: they are written for a person.
    expect(describeRequestFailure(failure("conflict"), wording)).toEqual({
      kind: "conflict",
      message: "the server's words",
      retryable: false,
    });
    expect(
      describeRequestFailure(
        failure("invalid_request", "Name too long."),
        wording,
      ),
    ).toMatchObject({
      kind: "rejected",
      message: "Name too long.",
    });
  });

  it("treats a class the feature did not name as a fault, not as something it can explain", () => {
    expect(describeRequestFailure(failure("conflict"), {})).toMatchObject({
      kind: "temporary",
      message: "The server had a problem. Try again in a moment.",
    });
  });

  it.each([
    [
      "network",
      "The request could not reach the server. Check your connection and try again.",
      true,
    ],
    [
      "internal_error",
      "The server had a problem. Try again in a moment.",
      true,
    ],
    ["rate_limited", "The server had a problem. Try again in a moment.", true],
    [
      "invalid-response",
      "The server had a problem. Try again in a moment.",
      true,
    ],
    [
      "idempotency_key_required",
      "The server had a problem. Try again in a moment.",
      false,
    ],
  ] as const)(
    "tells a %s as a temporary fault, retryable or not as the requester says",
    (code, message, retryable) => {
      expect(describeRequestFailure(failure(code), wording)).toEqual({
        kind: "temporary",
        message,
        retryable,
      });
    },
  );
});
