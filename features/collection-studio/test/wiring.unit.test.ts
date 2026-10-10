import { createDatabaseFromEnvironment } from "@ador/database/connection";
import { chainOptionSchema } from "@ador/shared/chain";
import {
  storageRegistry,
  unusedStorage,
} from "@ador/test-kit/storage-registry";
import { createProviderRegistry } from "@ador/plugin-kit/providers";
import { describe, expect, it, vi } from "vitest";

import { createCollectionStudioContextResolver } from "../src/context.ts";
import {
  createAssetPreviewResolver,
  createCollectionServiceResolver,
  createSubmissionServiceResolver,
} from "../src/runtime.ts";
import { signet } from "./support/stubs.ts";

const environment = {
  DATABASE_ACQUIRE_TIMEOUT_MS: "1000",
  DATABASE_IDLE_TIMEOUT_MS: "1000",
  DATABASE_POOL_MAX: "1",
  DATABASE_SSL_MODE: "disable",
  DATABASE_STATEMENT_TIMEOUT_MS: "1000",
  DATABASE_URL: "postgresql://app:secret@database.invalid/app",
};

const chains = [
  chainOptionSchema.parse({
    chainId: signet,
    displayName: "Bitcoin signet",
    enabled: true,
    family: "bitcoin-alkanes",
    role: "public-beta",
  }),
];

describe("collection studio context", () => {
  it("resolves storage and one database client once and shares them", async () => {
    const createStorage = vi.fn(() => unusedStorage);
    const resolve = createCollectionStudioContextResolver(
      storageRegistry(createStorage),
      environment,
    );
    const context = await resolve();
    expect(context.storage).toBe(unusedStorage);
    expect(await resolve()).toBe(context);
    expect(createStorage).toHaveBeenCalledOnce();
  });

  it("does not cache a failed resolution", async () => {
    const createStorage = vi
      .fn(() => unusedStorage)
      .mockImplementationOnce(() => {
        throw new Error("storage configuration is missing");
      });
    const resolve = createCollectionStudioContextResolver(
      storageRegistry(createStorage),
      environment,
    );
    await expect(resolve()).rejects.toThrow("storage configuration");
    await expect(resolve()).resolves.toBeDefined();
  });

  it("fails when storage is not registered or the database is misconfigured", async () => {
    await expect(
      createCollectionStudioContextResolver(
        createProviderRegistry([]),
        environment,
      )(),
    ).rejects.toThrow(/not registered/u);
    await expect(
      createCollectionStudioContextResolver(storageRegistry(), {})(),
    ).rejects.toThrow();
  });
});

describe("collection studio runtime", () => {
  it("builds the service and the preview source lazily from one shared context", async () => {
    // The pool connects lazily, and nothing here runs a query.
    const context = {
      database: createDatabaseFromEnvironment(environment),
      storage: unusedStorage,
    };
    const resolveContext = vi.fn(async () => context);
    const getService = createCollectionServiceResolver(resolveContext, chains);
    const getPreviews = createAssetPreviewResolver(resolveContext);
    const getSubmissions = createSubmissionServiceResolver(
      resolveContext,
      chains,
    );
    expect(resolveContext).not.toHaveBeenCalled();
    expect(await getService()).toBe(await getService());
    expect(await getPreviews()).toBe(await getPreviews());
    expect(await getSubmissions()).toBe(await getSubmissions());
    expect(resolveContext).toHaveBeenCalledTimes(3);
  });

  it("does not cache a failed context resolution", async () => {
    const resolveContext = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(new Error("unavailable"));
    const getService = createCollectionServiceResolver(resolveContext, chains);
    await expect(getService()).rejects.toThrow("unavailable");
    await expect(getService()).rejects.toThrow("unavailable");
    expect(resolveContext).toHaveBeenCalledTimes(2);
  });
});
