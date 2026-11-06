import { describe, expect, it } from "vitest";

import {
  failure,
  forbiddenMessage,
  idempotencyKeyConflict,
  invalidCursor,
  unauthenticated,
} from "../src/outcome.ts";

describe("operation failures", () => {
  it("carries the error code and message and is never ok", () => {
    expect(failure("conflict", "Stale.")).toEqual({
      error: "conflict",
      message: "Stale.",
      ok: false,
    });
  });

  it("carries a reason only when one is given", () => {
    expect(failure("conflict", "Stale.", "stale-version")).toEqual({
      error: "conflict",
      message: "Stale.",
      ok: false,
      reason: "stale-version",
    });
    expect(failure("conflict", "Stale.")).not.toHaveProperty("reason");
  });

  it("has one shared answer for a missing session", () => {
    expect(unauthenticated).toEqual({
      error: "unauthorized",
      message: "Authentication is required.",
      ok: false,
    });
  });
});

describe("the shared idempotency conflict", () => {
  it("is one conflict, answered the same by every operation that takes a key", () => {
    expect(idempotencyKeyConflict).toEqual({
      error: "conflict",
      message: "The idempotency key conflicts with another request.",
      ok: false,
    });
  });

  it("has one shared answer for a page cursor the list did not produce, as a bad request", () => {
    expect(invalidCursor).toEqual({
      error: "invalid_request",
      message: "The page cursor is not valid.",
      ok: false,
    });
  });

  it("has one sentence for a caller who lacks the capability", () => {
    expect(forbiddenMessage).toBe("The actor lacks the required capability.");
  });
});
