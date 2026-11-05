import { correlationIdSchema } from "@frostbite/shared/http";
import { describe, expect, it } from "vitest";

import {
  logAuthUnavailable,
  logInternalError,
} from "../src/server/http/internal-error-log.ts";

const base = {
  correlationId: correlationIdSchema.parse(
    "123e4567-e89b-42d3-a456-426614174000",
  ),
  operationId: "syncGameState",
};
const lines = (report: Parameters<typeof logInternalError>[0]) => {
  const written: string[] = [];
  logInternalError(report, (line) => written.push(line));
  return written.map((line) => JSON.parse(line) as Record<string, unknown>);
};

describe("the internal error log", () => {
  it("writes one JSON line naming the operation, the kind and the correlation id", () => {
    expect(
      lines({ ...base, code: "not_found", kind: "undeclared-error" }),
    ).toEqual([
      {
        code: "not_found",
        correlationId: "123e4567-e89b-42d3-a456-426614174000",
        event: "http.internal_error",
        kind: "undeclared-error",
        operationId: "syncGameState",
      },
    ]);
    expect(lines({ ...base, kind: "invalid-output" })[0]).toMatchObject({
      kind: "invalid-output",
    });
  });

  it("gives an exception's class, a database code and its stack frames, and never its message, which can carry the player's data", () => {
    const failure = new Error(
      "Failed query: insert ... params: secret@example.test",
      {
        cause: Object.assign(new Error("duplicate"), { code: "23505" }),
      },
    );
    failure.name = "DrizzleQueryError";
    const [line] = lines({ ...base, error: failure, kind: "exception" });
    expect(line).toMatchObject({ code: "23505", name: "DrizzleQueryError" });
    expect(Array.isArray(line?.frames)).toBe(true);
    expect((line?.frames as string[]).length).toBeLessThanOrEqual(8);
    expect(JSON.stringify(line)).not.toContain("secret@example.test");
    expect(JSON.stringify(line)).not.toContain("Failed query");
  });

  it("reads the code from the error itself when it has no cause, and copes with an error that is not an Error", () => {
    expect(
      lines({
        ...base,
        error: Object.assign(new Error("x"), { code: "ECONNRESET" }),
        kind: "exception",
      })[0],
    ).toMatchObject({ code: "ECONNRESET" });
    expect(
      lines({
        ...base,
        error: new Error("x", { cause: "text" }),
        kind: "exception",
      })[0],
    ).not.toHaveProperty("code");
    expect(
      lines({ ...base, error: "boom", kind: "exception" })[0],
    ).toMatchObject({
      frames: [],
      name: "string",
    });
  });

  it("writes to the process's error output by default", () => {
    const original = console.error;
    const seen: string[] = [];
    console.error = (line: string) => void seen.push(line);
    try {
      logInternalError({ ...base, kind: "invalid-output" });
    } finally {
      console.error = original;
    }
    expect(seen).toHaveLength(1);
  });
});

describe("the log for an unreachable session service", () => {
  it("writes the operation and the correlation id the caller was given", () => {
    const written: string[] = [];
    logAuthUnavailable({ ...base }, (line) => written.push(line));
    expect(JSON.parse(written[0] ?? "")).toEqual({
      correlationId: base.correlationId,
      event: "http.auth_unavailable",
      operationId: "syncGameState",
    });
  });

  it("writes to the error output by default", () => {
    const original = console.error;
    const seen: string[] = [];
    console.error = (line: string) => void seen.push(line);
    try {
      logAuthUnavailable({ ...base });
    } finally {
      console.error = original;
    }
    expect(seen).toHaveLength(1);
  });
});
