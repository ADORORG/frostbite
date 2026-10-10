import { unusedStorage } from "@ador/test-kit/storage-registry";
import { createDatabaseFromEnvironment } from "@ador/database/connection";
import { authorizationPolicy } from "@repo/config/authorization";
import { describe, expect, it, vi } from "vitest";

import {
  createPreviewResolver,
  createReviewServiceResolver,
} from "../src/runtime.ts";

const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://app:secret@database.invalid/app",
};

describe("review runtime", () => {
  it("builds the service and the preview source lazily, each once, from one shared context", async () => {
    // The pool connects lazily, and nothing here runs a query.
    const context = {
      database: createDatabaseFromEnvironment(environment),
      storage: unusedStorage,
    };
    const resolveContext = vi.fn(async () => context);
    const getService = createReviewServiceResolver(
      authorizationPolicy,
      resolveContext,
    );
    const getPreviews = createPreviewResolver(resolveContext);
    expect(resolveContext).not.toHaveBeenCalled();
    expect(await getService()).toBe(await getService());
    expect(await getPreviews()).toBe(await getPreviews());
    expect(resolveContext).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed context resolution", async () => {
    const resolveContext = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("unavailable"));
    const getService = createReviewServiceResolver(
      authorizationPolicy,
      resolveContext,
    );
    await expect(getService()).rejects.toThrow("unavailable");
    await expect(getService()).rejects.toThrow("unavailable");
    expect(resolveContext).toHaveBeenCalledTimes(2);
  });
});
