import { describe, expect, it, vi } from "vitest";

import { createUploadsContextResolver } from "../src/context.ts";
import {
  storageRegistry,
  unusedStorage,
} from "@ador/test-kit/storage-registry";

const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "2",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
};

describe("uploads context", () => {
  it("resolves storage and one database client once and shares them", async () => {
    const createStorage = vi.fn(() => unusedStorage);
    const resolve = createUploadsContextResolver(
      storageRegistry(createStorage),
      environment,
    );
    const first = resolve();
    expect(resolve()).toBe(first);
    const context = await first;
    expect(context.storage).toBe(unusedStorage);
    expect(context.database).toBeDefined();
    expect(await resolve()).toBe(context);
    expect(createStorage).toHaveBeenCalledOnce();
  });

  it("does not cache a failed resolution", async () => {
    const createStorage = vi
      .fn(() => unusedStorage)
      .mockImplementationOnce(() => {
        throw new Error("storage configuration is missing");
      });
    const resolve = createUploadsContextResolver(
      storageRegistry(createStorage),
      environment,
    );
    await expect(resolve()).rejects.toThrow("storage configuration");
    await expect(resolve()).resolves.toBeDefined();
  });

  it("rejects invalid database configuration without caching it", async () => {
    const resolve = createUploadsContextResolver(storageRegistry(), {
      ...environment,
      DATABASE_URL: "not-a-url",
    });
    await expect(resolve()).rejects.toThrow();
    await expect(resolve()).rejects.toThrow();
  });
});
