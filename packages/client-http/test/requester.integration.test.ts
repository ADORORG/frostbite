import { createServer, type Server } from "node:http";

import { idempotencyKeySchema } from "@frostbite/shared/http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ApiError } from "../src/api-error.ts";
import { createRequester, type FetchLike } from "../src/requester.ts";

// The requester is exercised over a real socket with the platform's real `fetch`, so wire details
// (headers, body framing, status handling, aborts) are proven rather than assumed.
const schema = z.object({ echoed: z.string() }).strict();
const key = idempotencyKeySchema.parse("0123456789abcdef0123456789abcdef");
const correlationId = "018f22f2-9c1a-7b21-8c45-0000000000aa";

let server: Server;
let origin: string;
const seen: { body: string; key: string | undefined; method: string }[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      seen.push({
        body,
        key: request.headers["idempotency-key"]?.toString(),
        method: request.method ?? "",
      });
      response.setHeader("content-type", "application/json");
      if (request.url === "/ok") {
        response.end(JSON.stringify({ echoed: body }));
      } else if (request.url === "/refused") {
        response.statusCode = 409;
        response.end(
          JSON.stringify({
            error: { code: "conflict", correlationId, message: "Stale." },
          }),
        );
      } else if (request.url === "/hang") {
        // Never answers: only an abort can end the request.
      } else {
        response.statusCode = 200;
        response.end(JSON.stringify({ unexpected: true }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("The test server has no TCP address");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const realFetch: FetchLike = (input, init) => fetch(`${origin}${input}`, init);

async function failureOf(attempt: Promise<unknown>): Promise<ApiError> {
  try {
    await attempt;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
}

describe("JSON requester over a real connection", () => {
  const request = createRequester(realFetch);

  it("delivers the method, JSON body, and idempotency key, and validates the answer", async () => {
    const value = await request({ method: "PUT", path: "/ok" }, schema, {
      body: { name: "x" },
      idempotencyKey: key,
    });
    expect(value).toEqual({ echoed: '{"name":"x"}' });
    expect(seen.at(-1)).toEqual({
      body: '{"name":"x"}',
      key,
      method: "PUT",
    });
  });

  it("turns the platform error envelope into an ApiError with its code and status", async () => {
    const error = await failureOf(
      request({ method: "POST", path: "/refused" }, schema),
    );
    expect([error.code, error.status]).toEqual(["conflict", 409]);
  });

  it("refuses a success body that breaks the contract", async () => {
    const error = await failureOf(
      request({ method: "POST", path: "/other" }, schema),
    );
    expect(error.code).toBe("invalid-response");
  });

  it("reports an unreachable server as a network failure", async () => {
    const offline = createRequester((_input, init) =>
      fetch("http://127.0.0.1:1/ok", init),
    );
    const error = await failureOf(
      offline({ method: "POST", path: "/ok" }, schema),
    );
    expect(error.code).toBe("network");
  });

  it("rethrows the caller's own abort unchanged", async () => {
    const controller = new AbortController();
    const pending = request({ method: "POST", path: "/hang" }, schema, {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
  });
});
