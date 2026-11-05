import type { ObjectStoragePort } from "@frostbite/object-storage/contracts";
import type { ImageProcessor } from "@frostbite/media/processing";
import {
  createProviderRegistry,
  defineProvider,
} from "@frostbite/plugin-kit/providers";
import { providerIdSchema } from "@frostbite/shared/providers";
import { describe, expect, it } from "vitest";

import { systemClock } from "../src/clock.ts";
import { createAssetPipelineResolver } from "../src/pipeline.ts";

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
const processor: ImageProcessor = { process: unused };

function providers(options: { readonly withProcessor: boolean }) {
  const registrations = [
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
  ];
  if (options.withProcessor)
    registrations.push(
      defineProvider({
        load: async () => ({
          capabilities: ["media-processing:image-derivatives"],
          createServices: () => ({
            "media-processing:image-derivatives": processor,
          }),
          id: "test-media-processing",
          version: "1.0.0",
        }),
        manifest: {
          capabilities: ["media-processing:image-derivatives"],
          id: "test-media-processing",
          requiredDecisionGates: [],
          version: "1.0.0",
        },
      }),
    );
  return createProviderRegistry(registrations);
}

function configureDatabase() {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.DATABASE_SSL_MODE = "disable";
  process.env.DATABASE_POOL_MAX = "2";
  process.env.DATABASE_ACQUIRE_TIMEOUT_MS = "1000";
  process.env.DATABASE_IDLE_TIMEOUT_MS = "1000";
  process.env.DATABASE_STATEMENT_TIMEOUT_MS = "1000";
}

describe("asset pipeline resolver", () => {
  it("uses the system clock unless one is injected", () => {
    expect(systemClock()).toBeInstanceOf(Date);
    expect(Math.abs(systemClock().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it("composes both activities from the typed provider capabilities and caches them", async () => {
    configureDatabase();
    const resolve = createAssetPipelineResolver(
      providers({ withProcessor: true }),
    );
    const first = resolve();
    expect(resolve()).toBe(first);
    const activities = await first;
    expect(Object.keys(activities).sort()).toEqual([
      "processAsset",
      "validateAsset",
    ]);
    expect(activities.validateAsset).toEqual(expect.any(Function));
    expect(activities.processAsset).toEqual(expect.any(Function));
  });

  it("reports a missing provider capability and does not cache the failure", async () => {
    configureDatabase();
    const resolve = createAssetPipelineResolver(
      providers({ withProcessor: false }),
    );
    const first = resolve();
    await expect(first).rejects.toThrow();
    const second = resolve();
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow();
  });

  it("rejects when the database configuration is invalid", async () => {
    delete process.env.DATABASE_URL;
    await expect(
      createAssetPipelineResolver(providers({ withProcessor: true }))(),
    ).rejects.toThrow();
    configureDatabase();
  });
});
