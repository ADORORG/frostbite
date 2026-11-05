import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
} from "@frostbite/database/connection";
import { describe, expect, it, vi } from "vitest";

import type { UploadsContext } from "../src/context.ts";
import { createLibraryServiceResolver } from "../src/library-runtime.ts";
import { unusedStorage } from "@frostbite/test-kit/storage-registry";

const context: UploadsContext = {
  // The pool connects lazily, and nothing here runs a query.
  database: createDatabaseClient(
    createDatabasePool(
      parseDatabaseEnvironment({
        DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
        DATABASE_IDLE_TIMEOUT_MS: "1000",
        DATABASE_POOL_MAX: "1",
        DATABASE_SSL_MODE: "disable",
        DATABASE_STATEMENT_TIMEOUT_MS: "1000",
        DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      }),
    ),
  ),
  storage: unusedStorage,
};

describe("library runtime", () => {
  it("builds one library service from the shared context and caches it", async () => {
    const resolveContext = vi.fn(async () => context);
    const resolve = createLibraryServiceResolver(resolveContext);
    const first = resolve();
    expect(resolve()).toBe(first);
    expect(await first).toMatchObject({ list: expect.any(Function) });
    expect(resolveContext).toHaveBeenCalledOnce();
  });

  it("does not cache a failed context resolution", async () => {
    const resolveContext = vi
      .fn(async () => context)
      .mockImplementationOnce(async () => {
        throw new Error("storage configuration is missing");
      });
    const resolve = createLibraryServiceResolver(resolveContext);
    await expect(resolve()).rejects.toThrow("storage configuration");
    await expect(resolve()).resolves.toBeDefined();
  });
});
