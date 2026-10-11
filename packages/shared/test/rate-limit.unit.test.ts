import { describe, expect, it } from "vitest";

import {
  decide,
  httpErrorEnvelopeSchema,
  rateLimitConfigSchema,
  rateLimitPolicySchema,
  resolveRateLimit,
  windowStart,
} from "../src/http/index.ts";

const perMinute = (limit: number) => ({ limit, windowMs: 60_000 });
const config = rateLimitConfigSchema.parse({
  address: perMinute(600),
  anonymous: perMinute(60),
  operations: { createUploadIntent: perMinute(30) },
  read: perMinute(300),
  version: 1,
  write: perMinute(100),
});

describe("a rate limit policy", () => {
  it.each([
    [1, 1_000],
    [100_000, 86_400_000],
  ])("accepts %i requests per %i ms", (limit, windowMs) => {
    expect(rateLimitPolicySchema.safeParse({ limit, windowMs }).success).toBe(
      true,
    );
  });

  it.each([
    ["no requests", { limit: 0, windowMs: 60_000 }],
    ["a fraction", { limit: 1.5, windowMs: 60_000 }],
    ["too many", { limit: 100_001, windowMs: 60_000 }],
    ["a window under a second", { limit: 5, windowMs: 999 }],
    ["a window over a day", { limit: 5, windowMs: 86_400_001 }],
    ["an unknown field", { extra: 1, limit: 5, windowMs: 60_000 }],
  ])("refuses %s", (_why, value) => {
    expect(rateLimitPolicySchema.safeParse(value).success).toBe(false);
  });
});

describe("windows and decisions", () => {
  const policy = perMinute(3);

  it("puts a time in the window that started at the last whole window", () => {
    expect(windowStart(new Date(125_000), 60_000)).toBe(120_000);
    expect(windowStart(new Date(120_000), 60_000)).toBe(120_000);
    expect(windowStart(new Date(179_999), 60_000)).toBe(120_000);
  });

  it("allows requests up to the limit and refuses the next, saying how many are left", () => {
    const now = new Date(120_000);
    expect(
      [1, 2, 3].map((hits) => decide(hits, { now, policy }).remaining),
    ).toEqual([2, 1, 0]);
    expect(
      [1, 2, 3, 4].map((hits) => decide(hits, { now, policy }).allowed),
    ).toEqual([true, true, true, false]);
    expect(decide(10, { now, policy }).remaining).toBe(0);
  });

  it("tells a caller to wait until the window ends, in whole seconds, and never less than one", () => {
    expect(
      decide(4, { now: new Date(120_000), policy }).retryAfterSeconds,
    ).toBe(60);
    expect(
      decide(4, { now: new Date(150_400), policy }).retryAfterSeconds,
    ).toBe(30);
    expect(
      decide(4, { now: new Date(179_999), policy }).retryAfterSeconds,
    ).toBe(1);
  });
});

describe("which allowance applies", () => {
  const request = (overrides: object) => ({
    authenticated: true,
    method: "POST",
    operationId: "saveCollectionDraft",
    ...overrides,
  });

  it("is the operation's own, for anyone, when it has one", () => {
    for (const authenticated of [true, false])
      expect(
        resolveRateLimit(
          config,
          request({ authenticated, operationId: "createUploadIntent" }),
        ),
      ).toEqual({ bucket: "createUploadIntent", policy: perMinute(30) });
  });

  it("is the general read or write allowance for a signed-in person, by method", () => {
    expect(resolveRateLimit(config, request({ method: "GET" }))).toEqual({
      bucket: "read",
      policy: perMinute(300),
    });
    for (const method of ["POST", "PUT", "DELETE", "PATCH"])
      expect(resolveRateLimit(config, request({ method }))).toEqual({
        bucket: "write",
        policy: perMinute(100),
      });
  });

  it("is the anonymous allowance for someone who is not signed in", () => {
    expect(
      resolveRateLimit(
        config,
        request({ authenticated: false, method: "GET" }),
      ),
    ).toEqual({
      bucket: "anonymous",
      policy: perMinute(60),
    });
  });

  it("refuses a policy with an operation id that is not one", () => {
    expect(
      rateLimitConfigSchema.safeParse({
        ...config,
        operations: { "Bad Id": perMinute(5) },
      }).success,
    ).toBe(false);
    expect(
      rateLimitConfigSchema.safeParse({ ...config, version: 0 }).success,
    ).toBe(false);
  });
});

describe("the too-many-requests error", () => {
  it("is a platform error code in the shared envelope", () => {
    expect(
      httpErrorEnvelopeSchema.safeParse({
        error: {
          code: "rate_limited",
          correlationId: "123e4567-e89b-42d3-a456-426614174000",
          message: "Too many requests.",
        },
      }).success,
    ).toBe(true);
  });
});
