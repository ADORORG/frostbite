import { describe, expect, it } from "vitest";

import {
  httpErrorEnvelopeSchema,
  idempotencyKeySchema,
} from "../src/http/index.js";
import { platformStatusSchema } from "../src/platform/status.js";

const correlationId = "123e4567-e89b-42d3-a456-426614174000";

describe("HTTP contracts", () => {
  it("accepts bounded opaque idempotency keys", () => {
    expect(idempotencyKeySchema.parse("mint.request_123")).toBe(
      "mint.request_123",
    );
    expect(() => idempotencyKeySchema.parse("short")).toThrow();
    expect(() =>
      idempotencyKeySchema.parse("invalid key with spaces"),
    ).toThrow();
  });

  it("keeps errors strict, safe, and correlated", () => {
    expect(
      httpErrorEnvelopeSchema.parse({
        error: {
          code: "invalid_request",
          correlationId,
          message: "Invalid request.",
        },
      }),
    ).toBeDefined();
    expect(() =>
      httpErrorEnvelopeSchema.parse({
        error: {
          code: "invalid_request",
          correlationId,
          message: "Invalid.",
          stack: "secret",
        },
      }),
    ).toThrow();
  });

  it("does not permit an optimistic platform status", () => {
    expect(() =>
      platformStatusSchema.parse({
        apiVersion: "v1",
        registeredFeatures: 1,
        stage: "live",
        transactionalActions: "enabled",
      }),
    ).toThrow();
  });
});

describe("a reason in the error envelope", () => {
  it("is optional, and only a lower-case name made of words joined by hyphens", () => {
    const envelope = (reason?: string) =>
      httpErrorEnvelopeSchema.safeParse({
        error: {
          code: "conflict",
          correlationId: "01890f0e-7c8a-7b3a-8a3e-0123456789ab",
          message: "No.",
          ...(reason === undefined ? {} : { reason }),
        },
      }).success;
    expect(envelope()).toBe(true);
    expect(envelope("wallet-held")).toBe(true);
    for (const bad of [
      "",
      "Wallet-held",
      "wallet held",
      "-held",
      "held-",
      "a--b",
      "x".repeat(65),
    ])
      expect(envelope(bad), bad).toBe(false);
  });
});
