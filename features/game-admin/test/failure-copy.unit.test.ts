import { ApiError } from "@frostbite/client-http";
import { describe, expect, it } from "vitest";

import { failureCopy, type StepRequest } from "../src/domain/failure-copy.ts";

const reference = "018f22f2-9c1a-7b21-8c45-0000000000aa";
const requests: readonly StepRequest[] = ["load", "record", "send", "start"];
const failed = (code: ConstructorParameters<typeof ApiError>[0]) =>
  new ApiError(code, null, "The server's own words.", reference);

describe("the words for a request that failed", () => {
  it("says a signed-out session is signed out, and does not blame the platform", () => {
    expect(failureCopy(failed("unauthorized"), "start")).toBe(
      "You are signed out. Sign in again.",
    );
  });

  it.each([
    ["forbidden", "not allowed to administer games"],
    ["rate_limited", "Too many requests"],
    ["conflict", "Another change to this step happened first"],
    [
      "invalid_request",
      "refused the request as invalid: The server's own words.",
    ],
  ] as const)(
    "names a %s for what it is and says the platform changed nothing",
    (code, words) => {
      for (const request of requests) {
        const text = failureCopy(failed(code), request);
        expect(text).toContain(words);
        expect(text).toContain("Nothing was changed.");
      }
    },
  );

  it.each([
    ["idempotency_key_required"],
    ["method_not_allowed"],
    ["not_found"],
  ] as const)("names the code of %s and its reference", (code) => {
    const text = failureCopy(failed(code), "load");
    expect(text).toContain(`(${code})`);
    expect(text).toContain(`Reference ${reference}`);
  });

  it("separates no connection, too slow, and a fault in the platform", () => {
    const network = failureCopy(failed("network"), "start");
    const slow = failureCopy(
      new DOMException("timed out", "TimeoutError"),
      "start",
    );
    const fault = failureCopy(failed("internal_error"), "start");
    expect(network).toContain("could not be reached while building the step");
    expect(slow).toContain("took too long to answer while building the step");
    expect(fault).toContain("The platform failed while building the step.");
    expect(new Set([network, slow, fault]).size).toBe(3);
  });

  it("gives a fault's reference so it can be found in the log, and none when the server sent none", () => {
    expect(failureCopy(failed("internal_error"), "start")).toContain(
      `Reference ${reference}, which staff can find in the platform's log.`,
    );
    expect(
      failureCopy(new ApiError("internal_error", 500, "x"), "start"),
    ).not.toContain("Reference");
    expect(failureCopy(failed("invalid-response"), "load")).toContain(
      "does not understand while loading the steps",
    );
  });

  it("does not promise that a send changed nothing, since the network may have taken it", () => {
    for (const cause of [
      failed("network"),
      failed("internal_error"),
      failed("invalid-response"),
      new DOMException("timed out", "TimeoutError"),
    ]) {
      const text = failureCopy(cause, "send");
      expect(text).toContain("may or may not have been sent");
      expect(text).not.toContain("Nothing was changed.");
    }
  });

  it("names a fault in the page itself, which is not the platform's", () => {
    const text = failureCopy(new TypeError("x is undefined"), "record");
    expect(text).toBe(
      "This page hit an unexpected error while recording the contract's address. Nothing was changed.",
    );
  });
});
