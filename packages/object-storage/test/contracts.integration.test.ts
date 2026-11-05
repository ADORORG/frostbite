import { ObjectStorageError, parseObjectKey } from "@frostbite/object-storage";
import { describe, expect, it } from "vitest";

describe("public package boundary", () => {
  it("resolves runtime validators and stable errors through the package export", () => {
    expect(parseObjectKey("draft/asset.png")).toBe("draft/asset.png");
    expect(new ObjectStorageError("not-found", "Missing.")).toMatchObject({
      code: "not-found",
      name: "ObjectStorageError",
    });
  });
});
