import { authorizationPolicy } from "@repo/config/authorization";
import { describe, expect, it } from "vitest";

import { createReviewServiceResolver } from "../src/runtime.ts";

const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://app:secret@database.invalid/app",
};

describe("review service resolver", () => {
  it("builds the service once, on first use", async () => {
    // The pool connects lazily, and nothing here runs a query.
    const resolve = createReviewServiceResolver(
      authorizationPolicy,
      environment,
    );
    const service = await resolve();
    expect(await resolve()).toBe(service);
    expect(typeof service.decide).toBe("function");
  });

  it("fails on a misconfigured database and does not cache the failure", async () => {
    const resolve = createReviewServiceResolver(authorizationPolicy, {});
    await expect(resolve()).rejects.toThrow();
    await expect(resolve()).rejects.toThrow();
  });
});
