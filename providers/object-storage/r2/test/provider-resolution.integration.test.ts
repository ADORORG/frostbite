import {
  createProviderRegistry,
  defineProvider,
} from "@frostbite/plugin-kit/providers";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { createR2ObjectStorageProviderEntrypoint } from "../src/provider-entrypoint.ts";

const environment = {
  APP_ENV: "test",
  R2_ACCESS_KEY_ID: "access-key",
  R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  R2_PRIVATE_BUCKET: "private-assets",
  R2_PUBLIC_BUCKET: "public-assets",
  R2_REGION: "auto",
  R2_SECRET_ACCESS_KEY: "secret-key",
};

function registry(source: NodeJS.ProcessEnv) {
  return createProviderRegistry([
    defineProvider({
      load: async () => createR2ObjectStorageProviderEntrypoint(source),
      manifest: {
        capabilities: ["object-storage:s3-compatible"],
        id: "r2-object-storage",
        requiredDecisionGates: [],
        version: "1.0.0",
      },
    }),
  ]);
}

describe("R2 provider runtime resolution", () => {
  it("resolves a provider-neutral storage service lazily", async () => {
    await expect(
      registry(environment).resolve("object-storage:s3-compatible"),
    ).resolves.toMatchObject({
      head: expect.any(Function),
      presignPrivateUpload: expect.any(Function),
      providerId: "r2-object-storage",
      write: expect.any(Function),
    });
  });

  it("fails closed when selected-provider configuration is absent", async () => {
    await expect(
      registry({}).resolve("object-storage:s3-compatible"),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
