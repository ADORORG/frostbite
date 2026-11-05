import {
  createProviderRegistry,
  defineProvider,
} from "@frostbite/plugin-kit/providers";
import type { ObjectStoragePort } from "@frostbite/object-storage/contracts";
import { providerIdSchema } from "@frostbite/shared/providers";
import { describe, expect, it } from "vitest";

import { createUploadCleanupResolver } from "../src/cleanup.ts";

const unused = async (): Promise<never> => {
  throw new Error("unused");
};
const storage: ObjectStoragePort = {
  copyPrivateToPublicIfAbsent: unused,
  delete: unused,
  head: unused,
  presignPrivateRead: unused,
  presignPrivateUpload: unused,
  providerId: providerIdSchema.parse("test-object-storage"),
  read: unused,
  write: unused,
};

const withStorage = createProviderRegistry([
  defineProvider({
    load: async () => ({
      capabilities: ["object-storage:s3-compatible"],
      createServices: () => ({ "object-storage:s3-compatible": storage }),
      id: "test-object-storage",
      version: "1.0.0",
    }),
    manifest: {
      capabilities: ["object-storage:s3-compatible"],
      id: "test-object-storage",
      requiredDecisionGates: [],
      version: "1.0.0",
    },
  }),
]);

function configureDatabase() {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.DATABASE_SSL_MODE = "disable";
  process.env.DATABASE_POOL_MAX = "2";
  process.env.DATABASE_ACQUIRE_TIMEOUT_MS = "1000";
  process.env.DATABASE_IDLE_TIMEOUT_MS = "1000";
  process.env.DATABASE_STATEMENT_TIMEOUT_MS = "1000";
}

describe("upload cleanup resolver", () => {
  it("composes the cleanup service from the object-storage capability and caches it", async () => {
    configureDatabase();
    const resolve = createUploadCleanupResolver(withStorage);
    const first = resolve();
    expect(resolve()).toBe(first);
    await expect(first).resolves.toEqual({ sweep: expect.any(Function) });
  });

  it("reports a missing storage capability and does not cache the failure", async () => {
    configureDatabase();
    const resolve = createUploadCleanupResolver(createProviderRegistry([]));
    const first = resolve();
    await expect(first).rejects.toThrow();
    const second = resolve();
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow();
  });

  it("rejects when the database configuration is invalid", async () => {
    delete process.env.DATABASE_URL;
    await expect(createUploadCleanupResolver(withStorage)()).rejects.toThrow();
    configureDatabase();
  });
});
