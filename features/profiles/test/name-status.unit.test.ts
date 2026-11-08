import { describe, expect, it } from "vitest";

import { nameStatusOf } from "../src/domain/name-status.ts";

const bounds = { maxLength: 20, minLength: 3 };

describe("what the name field says about a name", () => {
  it("says nothing about an empty name", () => {
    expect(nameStatusOf("", bounds, { kind: "idle" })).toEqual({
      error: null,
      note: null,
    });
  });

  it.each([
    ["ab", "Use at least 3 characters."],
    [
      "a b",
      "Letters, numbers, _ and - only, starting with a letter or number.",
    ],
    ["x".repeat(21), "Keep it to 20 characters or fewer."],
  ])(
    "finds the problem with the shape of %j at once, without asking",
    (name, error) => {
      expect(nameStatusOf(name, bounds, { kind: "checking" })).toEqual({
        error,
        note: null,
      });
    },
  );

  it("says it is checking, and when it could not check", () => {
    expect(nameStatusOf("Ada", bounds, { kind: "checking" }).note).toEqual({
      text: "Checking…",
      tone: "wait",
    });
    expect(nameStatusOf("Ada", bounds, { kind: "failed" }).note?.tone).toBe(
      "wait",
    );
    expect(nameStatusOf("Ada", bounds, { kind: "idle" })).toEqual({
      error: null,
      note: null,
    });
  });

  it("turns each answer of the server into a note or an error", () => {
    const answer = (result: Parameters<typeof nameStatusOf>[2]) =>
      nameStatusOf("Ada", bounds, result);
    expect(
      answer({ kind: "result", result: { status: "available" } }).note?.tone,
    ).toBe("good");
    expect(
      answer({ kind: "result", result: { status: "yours" } }).note?.tone,
    ).toBe("good");
    expect(answer({ kind: "result", result: { status: "taken" } }).error).toBe(
      "Someone already has that name.",
    );
    expect(
      answer({
        kind: "result",
        result: { status: "locked", until: "2026-12-08T00:00:00.000Z" },
      }).error,
    ).toBe("You can change your name again on Dec 8, 2026.");
    expect(
      answer({
        kind: "result",
        result: { reason: "blocked", status: "invalid" },
      }).error,
    ).toBe("That name isn't available. Try another.");
  });
});
