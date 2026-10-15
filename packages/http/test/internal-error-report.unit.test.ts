import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import {
  executeHttpOperation,
  type HttpOperation,
  type InternalErrorReport,
} from "../src/operation.ts";

const correlationId = "123e4567-e89b-42d3-a456-426614174000";
type TestOperation = HttpOperation<{ name: string }, { message: string }>;
const operation = (execute: TestOperation["execute"]): TestOperation => ({
  access: { kind: "public" },
  applicationErrors: ["conflict"],
  execute,
  idempotency: "none",
  input: "json",
  inputSchema: z.object({ name: z.string() }).strict(),
  method: "POST",
  operationId: "testOperation",
  outputSchema: z.object({ message: z.string() }).strict(),
  path: "/api/v1/test",
});
const request = {
  actorSession: null,
  actorUserId: null,
  headers: {},
  method: "POST",
  rawInput: { name: "Ada" },
};

async function run(
  execute: TestOperation["execute"],
  report?: (report: InternalErrorReport) => void,
) {
  return executeHttpOperation(operation(execute), request, {
    createCorrelationId: () => correlationId,
    ...(report === undefined ? {} : { report }),
  });
}

describe("telling the operator about an internal error", () => {
  it("reports an operation that threw, with the error and the correlation id the caller was given", async () => {
    const report = vi.fn();
    const failure = new Error("database password is hunter2");
    const response = await run(async () => {
      throw failure;
    }, report);
    expect(response.status).toBe(500);
    expect(report).toHaveBeenCalledWith({
      correlationId,
      error: failure,
      kind: "exception",
      operationId: "testOperation",
    });
    // The caller learns nothing of the cause.
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("reports an application error the operation did not declare, with its code", async () => {
    const report = vi.fn();
    const response = await run(
      async () => ({ error: "not_found", message: "x", ok: false }),
      report,
    );
    expect(response.status).toBe(500);
    expect(report).toHaveBeenCalledWith({
      code: "not_found",
      correlationId,
      kind: "undeclared-error",
      operationId: "testOperation",
    });
  });

  it("reports an answer that does not match the output contract", async () => {
    const report = vi.fn();
    const response = await run(
      async () => ({ ok: true, value: { message: 1 } as never }),
      report,
    );
    expect(response.status).toBe(500);
    expect(report).toHaveBeenCalledWith({
      correlationId,
      kind: "invalid-output",
      operationId: "testOperation",
    });
  });

  it("reports nothing for an answer that is right, a declared error, or a bad request", async () => {
    const report = vi.fn();
    await run(async () => ({ ok: true, value: { message: "ok" } }), report);
    await run(
      async () => ({ error: "conflict", message: "x", ok: false }),
      report,
    );
    await executeHttpOperation(
      operation(async () => ({ ok: true, value: { message: "ok" } })),
      { ...request, rawInput: {} },
      { createCorrelationId: () => correlationId, report },
    );
    expect(report).not.toHaveBeenCalled();
  });

  it("answers the same when the report itself fails, or when there is none", async () => {
    const throwing = await run(
      async () => {
        throw new Error("x");
      },
      () => {
        throw new Error("the log is full");
      },
    );
    const silent = await run(async () => {
      throw new Error("x");
    });
    expect(throwing.status).toBe(500);
    expect(silent.body).toEqual(throwing.body);
  });
});
