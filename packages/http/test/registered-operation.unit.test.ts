import { z } from "zod";
import { describe, expect, it } from "vitest";

import { registerHttpOperation } from "../src/registered-operation.js";

const correlationId = "018f47f0-7b5c-7c5b-8d56-43d493d8f001";

describe("registerHttpOperation", () => {
  it("preserves route, documentation, and typed execution", async () => {
    const operation = registerHttpOperation({
      access: { kind: "public" },
      applicationErrors: [],
      execute: async ({ name }: { readonly name: string }) => ({
        ok: true as const,
        value: { greeting: `Hello ${name}` },
      }),
      idempotency: "none",
      input: "json",
      inputSchema: z.object({ name: z.string().min(1) }),
      method: "POST",
      operationId: "createGreeting",
      outputSchema: z.object({ greeting: z.string() }),
      path: "/api/v1/greetings",
    });

    expect(operation.route).toEqual({
      method: "POST",
      operationId: "createGreeting",
      path: "/api/v1/greetings",
    });
    expect(operation.describe().operation.operationId).toBe("createGreeting");
    await expect(
      operation.execute(
        {
          actorSession: null,
          actorUserId: null,
          headers: {},
          method: "POST",
          rawInput: { name: "Ada" },
        },
        { createCorrelationId: () => correlationId },
      ),
    ).resolves.toMatchObject({ body: { greeting: "Hello Ada" }, status: 200 });
  });

  it("retains boundary validation after erasing operation generics", async () => {
    const operation = registerHttpOperation({
      access: { kind: "public" },
      applicationErrors: [],
      execute: async () => ({ ok: true as const, value: { accepted: true } }),
      idempotency: "none",
      input: "json",
      inputSchema: z.object({ name: z.string().min(1) }),
      method: "POST",
      operationId: "createGreeting",
      outputSchema: z.object({ accepted: z.boolean() }),
      path: "/api/v1/greetings",
    });

    await expect(
      operation.execute(
        {
          actorSession: null,
          actorUserId: null,
          headers: {},
          method: "POST",
          rawInput: {},
        },
        { createCorrelationId: () => correlationId },
      ),
    ).resolves.toMatchObject({
      body: { error: { code: "invalid_request" } },
      status: 400,
    });
  });

  it("says how its input arrives, and refuses a query string on anything but a GET", () => {
    const declared = (method: "GET" | "POST") => ({
      access: { kind: "public" } as const,
      applicationErrors: [],
      ...(method === "GET" ? { cache: { kind: "revalidate" } as const } : {}),
      execute: async () => ({ ok: true as const, value: { accepted: true } }),
      idempotency: "none" as const,
      input: "query" as const,
      inputSchema: z.object({}),
      method,
      operationId: "readThing",
      outputSchema: z.object({ accepted: z.boolean() }),
      path: "/api/v1/things" as const,
    });
    expect(registerHttpOperation(declared("GET")).input).toBe("query");
    expect(() => registerHttpOperation(declared("POST"))).toThrow(
      "readThing reads a query string, so it must be a GET",
    );
  });

  const read = (over: object = {}) => ({
    access: { kind: "public" } as const,
    applicationErrors: [],
    cache: { kind: "revalidate" } as const,
    execute: async () => ({ ok: true as const, value: { accepted: true } }),
    idempotency: "none" as const,
    input: "none" as const,
    inputSchema: z.object({}),
    method: "GET" as const,
    operationId: "readThing",
    outputSchema: z.object({ accepted: z.boolean() }),
    path: "/api/v1/things" as const,
    ...over,
  });

  it("makes every read state how it is kept, and no write do", () => {
    expect(registerHttpOperation(read()).cache).toEqual({ kind: "revalidate" });
    expect(() => registerHttpOperation(read({ cache: undefined }))).toThrow(
      "a GET states its cache policy, and nothing else does",
    );
    expect(() => registerHttpOperation(read({ method: "POST" }))).toThrow(
      "a GET states its cache policy",
    );
    expect(
      registerHttpOperation(read({ cache: undefined, method: "POST" })).cache,
    ).toBeUndefined();
  });

  it("refuses a lifetime that is not a whole number of seconds", () => {
    expect(() =>
      registerHttpOperation(read({ cache: { kind: "max-age", seconds: 0 } })),
    ).toThrow("whole number of seconds");
  });

  it("says whether it answers with a file", () => {
    expect(registerHttpOperation(read()).file).toBe(false);
    expect(registerHttpOperation(read({ files: ["image/svg+xml"] })).file).toBe(
      true,
    );
  });
});
