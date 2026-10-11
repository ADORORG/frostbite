import { ApiError } from "@ador/client-http";
import { describe, expect, it } from "vitest";

import { describeFailure } from "../../src/client/error-copy.ts";

describe("failure copy", () => {
  it.each([
    ["unauthorized", 401, "sign-in", false],
    ["forbidden", 403, "not-approved", false],
    ["not_found", 404, "not-found", false],
    ["conflict", 409, "conflict", false],
    ["invalid_request", 400, "rejected", false],
    ["internal_error", 500, "temporary", true],
    ["network", null, "temporary", true],
    ["invalid-response", 200, "temporary", true],
    ["method_not_allowed", 405, "temporary", false],
    ["idempotency_key_required", 400, "temporary", false],
  ] as const)(
    "describes a %s failure as %s (retryable: %s)",
    (code, status, kind, retryable) => {
      const failure = describeFailure(
        new ApiError(code, status, "Server words."),
      );
      expect([failure.kind, failure.retryable]).toEqual([kind, retryable]);
      expect(failure.message).toMatch(/\w+/u);
    },
  );

  it("passes the server's own words on for a conflict or a rejected request", () => {
    expect(
      describeFailure(new ApiError("conflict", 409, "The draft changed."))
        .message,
    ).toBe("The draft changed.");
    expect(
      describeFailure(new ApiError("invalid_request", 400, "Bad input."))
        .message,
    ).toBe("Bad input.");
  });

  it("says a lost connection is a connection problem", () => {
    expect(describeFailure(new ApiError("network", null, "x")).message).toMatch(
      /connection/u,
    );
  });

  it("treats anything that is not an API error as a retryable, unexplained problem", () => {
    expect(describeFailure(new TypeError("boom"))).toEqual({
      kind: "temporary",
      message: "Something went wrong. Try again.",
      retryable: true,
    });
  });
});
