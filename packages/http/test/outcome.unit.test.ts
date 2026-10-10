import { describe, expect, it } from "vitest";

import { failure, unauthenticated } from "../src/outcome.ts";

describe("operation failures", () => {
  it("carries the error code and message and is never ok", () => {
    expect(failure("conflict", "Stale.")).toEqual({
      error: "conflict",
      message: "Stale.",
      ok: false,
    });
  });

  it("has one shared answer for a missing session", () => {
    expect(unauthenticated).toEqual({
      error: "unauthorized",
      message: "Authentication is required.",
      ok: false,
    });
  });
});
