import type { ProviderRegistry } from "@frostbite/plugin-kit/providers";
import { describe, expectTypeOf, it } from "vitest";

import type { ObjectStoragePort } from "../src/contracts.ts";

describe("object-storage provider service contract", () => {
  it("types provider resolution without importing an adapter", () => {
    const resolveStorage = (registry: ProviderRegistry) =>
      registry.resolve("object-storage:s3-compatible");

    expectTypeOf(
      resolveStorage,
    ).returns.resolves.toEqualTypeOf<ObjectStoragePort>();
  });
});
