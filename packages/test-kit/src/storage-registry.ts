// Loads the `object-storage:s3-compatible` service typing into the provider registry.
import type {} from "@ador/object-storage";
import type { ObjectStoragePort } from "@ador/object-storage/contracts";
import {
  createProviderRegistry,
  defineProvider,
  type ProviderRegistry,
} from "@ador/plugin-kit/providers";
import { providerIdSchema } from "@ador/shared/providers";
import { vi } from "vitest";

const unused = async (): Promise<never> => {
  throw new Error("unused");
};

export const unusedStorage: ObjectStoragePort = {
  copyPrivateToPublicIfAbsent: unused,
  delete: vi.fn(async () => undefined),
  head: vi.fn(async () => null),
  presignPrivateRead: unused,
  presignPrivateUpload: unused,
  providerId: providerIdSchema.parse("test-object-storage"),
  read: unused,
  write: unused,
};

// A registry whose only provider supplies `object-storage:s3-compatible` from `createStorage`.
export function storageRegistry(
  createStorage: () => ObjectStoragePort = () => unusedStorage,
): ProviderRegistry {
  return createProviderRegistry([
    defineProvider({
      load: async () => ({
        capabilities: ["object-storage:s3-compatible"],
        createServices: () => ({
          "object-storage:s3-compatible": createStorage(),
        }),
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
}
