import type { DatabaseClient } from "@ador/database/connection";
import type {
  ReserveUploadIntentResult,
  UploadIntentRepository,
  createUploadIntentService as CreateUploadIntentService,
} from "@ador/uploads";
import { describe, expect, it, vi } from "vitest";

type ServiceDependencies = Parameters<typeof CreateUploadIntentService>[0];

const mockedRepository: UploadIntentRepository = {
  complete: vi.fn(),
  findForCompletion: vi.fn(),
  markSigningFailed: vi.fn(async () => undefined),
  reserve: vi.fn(async (): Promise<ReserveUploadIntentResult> => ({
    kind: "conflict",
  })),
};

const runtimeMocks = vi.hoisted(() => ({
  createRepository: vi.fn(
    (database: DatabaseClient): UploadIntentRepository => {
      void database;
      return mockedRepository;
    },
  ),
  createService: vi.fn((dependencies: ServiceDependencies) => {
    dependencies.clock();
    dependencies.createDraftKey();
    dependencies.createId();
    return { complete: vi.fn(), create: vi.fn() };
  }),
}));

vi.mock("@ador/uploads", () => ({
  createDrizzleUploadIntentRepository: runtimeMocks.createRepository,
  createUploadIntentService: runtimeMocks.createService,
}));

import { createUploadsContextResolver } from "../src/context.ts";
import {
  storageRegistry,
  unusedStorage,
} from "@ador/test-kit/storage-registry";
import { createUploadServiceResolver } from "../src/runtime.ts";

describe("upload runtime", () => {
  it("constructs and caches one provider-neutral service", async () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.DATABASE_SSL_MODE = "disable";
    process.env.DATABASE_POOL_MAX = "2";
    process.env.DATABASE_ACQUIRE_TIMEOUT_MS = "1000";
    process.env.DATABASE_IDLE_TIMEOUT_MS = "1000";
    process.env.DATABASE_STATEMENT_TIMEOUT_MS = "1000";
    const resolve = createUploadServiceResolver(
      createUploadsContextResolver(storageRegistry()),
    );
    const first = resolve();
    expect(resolve()).toBe(first);
    await expect(first).resolves.toBeDefined();
    expect(runtimeMocks.createRepository).toHaveBeenCalledOnce();
    expect(runtimeMocks.createService).toHaveBeenCalledWith(
      expect.objectContaining({ storage: unusedStorage }),
    );
  });

  it("does not cache a failed context resolution", async () => {
    const resolveContext = vi
      .fn()
      .mockRejectedValueOnce(new Error("storage configuration is missing"))
      .mockResolvedValue({ database: {}, storage: unusedStorage });
    const resolve = createUploadServiceResolver(resolveContext);
    await expect(resolve()).rejects.toThrow("storage configuration");
    await expect(resolve()).resolves.toBeDefined();
  });
});
