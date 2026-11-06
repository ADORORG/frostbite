import { parseObjectKey } from "@frostbite/object-storage/contracts";
import { describe, expect, it, vi } from "vitest";

import { storageRegistry, unusedStorage } from "../src/storage-registry.ts";

describe("storage registry fixture", () => {
  it("supplies the object-storage capability from the given factory, once", async () => {
    const createStorage = vi.fn(() => unusedStorage);
    const registry = storageRegistry(createStorage);
    expect(registry.hasCapability("object-storage:s3-compatible")).toBe(true);
    const resolved = await registry.resolve("object-storage:s3-compatible");
    expect(resolved).toBe(unusedStorage);
    await registry.resolve("object-storage:s3-compatible");
    expect(createStorage).toHaveBeenCalledOnce();
  });

  it("defaults to a storage that fails on any call it was not given", async () => {
    const resolved = await storageRegistry().resolve(
      "object-storage:s3-compatible",
    );
    await expect(
      resolved.read({ key: parseObjectKey("drafts/k"), scope: "private" }),
    ).rejects.toThrow("unused");
    expect(
      await resolved.head({
        key: parseObjectKey("drafts/k"),
        scope: "private",
      }),
    ).toBeNull();
  });
});
