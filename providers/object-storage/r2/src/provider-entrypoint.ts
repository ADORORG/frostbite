import type { ProviderEntrypoint } from "@frostbite/plugin-kit/providers";
import type { ObjectStorageProviderServices } from "@frostbite/object-storage";

import { parseR2Environment } from "./config.ts";
import { createR2ObjectStorage } from "./create-adapter.ts";
import { r2ObjectStorageProviderId } from "./identity.ts";

export function createR2ObjectStorageProviderEntrypoint(
  environment: NodeJS.ProcessEnv,
): ProviderEntrypoint {
  return {
    capabilities: ["object-storage:s3-compatible"],
    createServices: (): ObjectStorageProviderServices => ({
      "object-storage:s3-compatible": createR2ObjectStorage(
        parseR2Environment(environment),
      ),
    }),
    id: r2ObjectStorageProviderId,
    version: "1.0.0",
  };
}
