import { ApiError } from "@frostbite/client-http";
import { describe, expect, it } from "vitest";

import { describeFailure } from "../../src/client/error-copy.ts";

describe("failure copy", () => {
  it.each([
    ["unauthorized", 401, "sign-in", false],
    ["forbidden", 403, "not-permitted", false],
    ["not_found", 404, "not-found", false],
    ["conflict", 409, "conflict", false],
    ["invalid_request", 400, "rejected", false],
    ["internal_error", 500, "temporary", true],
    ["network", null, "temporary", true],
    ["invalid-response", 200, "temporary", true],
    ["method_not_allowed", 405, "temporary", false],
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
      describeFailure(
        new ApiError("conflict", 409, "This submission is approved."),
      ).message,
    ).toBe("This submission is approved.");
    expect(
      describeFailure(new ApiError("invalid_request", 400, "Bad input."))
        .message,
    ).toBe("Bad input.");
  });

  it("says who may decide when a reviewer is refused, and offers a retry for anything that is not an API error", () => {
    expect(
      describeFailure(new ApiError("forbidden", 403, "x")).message,
    ).toContain("nobody can review their own collection");
    expect(describeFailure(new Error("boom"))).toEqual({
      kind: "temporary",
      message: "Something went wrong. Try again.",
      retryable: true,
    });
  });

  it("distinguishes a network failure from a server fault", () => {
    expect(
      describeFailure(new ApiError("network", null, "x")).message,
    ).toContain("Check your connection");
    expect(
      describeFailure(new ApiError("internal_error", 500, "x")).message,
    ).toContain("server had a problem");
  });
});
