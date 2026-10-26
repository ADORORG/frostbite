import { ApiError } from "@ador/client-http";
import { accountOutcomes } from "@ador/shared/account-outcomes";
import { describe, expect, it } from "vitest";

import { failed, failedFrom, outcomeOf } from "../src/client/outcome.ts";
import { apiFailure } from "./support/failures.ts";

describe("what a failed request means", () => {
  it("is what the server's reason says when the catalogue knows it, whatever the status class or the words", () => {
    expect(outcomeOf(apiFailure("conflict", "wallet-held", "anything"))).toBe(
      "wallet-held",
    );
    // A reason beats the class: this is how two conflicts are told apart.
    expect(outcomeOf(apiFailure("conflict", "email-taken"))).toBe(
      "email-taken",
    );
    expect(outcomeOf(apiFailure("forbidden", "not-an-administrator"))).toBe(
      "not-an-administrator",
    );
  });

  it("does not trust a reason it was not built with, and falls back to the status class", () => {
    expect(outcomeOf(apiFailure("unauthorized", "toString"))).toBe(
      "signed-out",
    );
    expect(
      outcomeOf(apiFailure("conflict", "made-up"), "wallet-unusable"),
    ).toBe("wallet-unusable");
  });

  it.each([
    ["network", "network"],
    ["internal_error", "network"],
    ["invalid-response", "network"],
    ["rate_limited", "rate-limited"],
    ["unauthorized", "signed-out"],
    ["forbidden", "recent-authentication-required"],
  ] as const)("takes a %s with no reason as %s", (code, outcome) => {
    expect(outcomeOf(apiFailure(code))).toBe(outcome);
  });

  it("takes any other unnamed answer as what the step that asked says it is", () => {
    expect(outcomeOf(apiFailure("conflict"))).toBe("network");
    expect(outcomeOf(apiFailure("not_found"), "code-wrong")).toBe("code-wrong");
  });

  it("never reads the message to decide", () => {
    expect(
      outcomeOf(
        apiFailure("conflict", null, accountOutcomes["wallet-held"].message),
        "wallet-unusable",
      ),
    ).toBe("wallet-unusable");
  });

  it("does not hide a failure that is not the server's", () => {
    expect(() => outcomeOf(new TypeError("a bug"))).toThrow("a bug");
    expect(() => failedFrom(new TypeError("a bug"))).toThrow("a bug");
  });
});

describe("a failed step as a page tells it", () => {
  it("carries the outcome and the catalogue's words", () => {
    expect(failed("wallet-held")).toEqual({
      kind: "failed",
      message: accountOutcomes["wallet-held"].message,
      outcome: "wallet-held",
    });
  });

  it("shows the server's words only for the outcomes that ask for them", () => {
    expect(
      failedFrom(
        apiFailure("conflict", "code-too-soon", "Ask again in 30 seconds."),
      ).message,
    ).toBe("Ask again in 30 seconds.");
    expect(
      failedFrom(apiFailure("conflict", "wallet-held", "something else"))
        .message,
    ).toBe(accountOutcomes["wallet-held"].message);
  });

  it("is built from an ApiError's own reason", () => {
    expect(
      failedFrom(new ApiError("conflict", 409, "x", null, "email-taken"))
        .outcome,
    ).toBe("email-taken");
  });
});
